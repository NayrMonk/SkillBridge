import { Pool } from 'pg';
import { RedisClientType } from 'redis';

interface CreateNotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
}

export class NotificationService {
  constructor(
    private db: Pool,
    private redis: RedisClientType
  ) {}

  async createNotification(data: CreateNotificationData) {
    const result = await this.db.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.userId,
        data.type,
        data.title,
        data.message,
        data.data ? JSON.stringify(data.data) : null
      ]
    );

    const notification = result.rows[0];

    // Publish to Redis for real-time delivery
    await this.redis.publish(
      `notifications:${data.userId}`,
      JSON.stringify(notification)
    );

    // Increment unread count in Redis
    await this.redis.incr(`unread_count:${data.userId}`);

    return notification;
  }

  async getNotifications(
    userId: string,
    options: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { unreadOnly = false, limit = 20, offset = 0 } = options;

    let query = `
      SELECT * FROM notifications
      WHERE user_id = $1
    `;

    const params: any[] = [userId];

    if (unreadOnly) {
      query += ` AND is_read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return result.rows;
  }

  async getUnreadCount(userId: string): Promise<number> {
    // Try Redis first
    const cached = await this.redis.get(`unread_count:${userId}`);
    if (cached) {
      return parseInt(cached);
    }

    // Fallback to database
    const result = await this.db.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    const count = parseInt(result.rows[0].count);

    // Cache in Redis
    await this.redis.setEx(`unread_count:${userId}`, 300, count.toString());

    return count;
  }

  async markAsRead(notificationId: string, userId: string) {
    const result = await this.db.query(
      `UPDATE notifications 
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [notificationId, userId]
    );

    if (result.rows.length > 0) {
      // Decrement unread count
      await this.redis.decr(`unread_count:${userId}`);
    }

    return result.rows[0];
  }

  async markAllAsRead(userId: string) {
    await this.db.query(
      `UPDATE notifications 
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    // Reset unread count
    await this.redis.setEx(`unread_count:${userId}`, 300, '0');
  }

  async deleteNotification(notificationId: string, userId: string) {
    await this.db.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
  }

  // Send bulk notifications
  async sendBulkNotifications(
    userIds: string[],
    notification: Omit<CreateNotificationData, 'userId'>
  ) {
    const notifications = [];

    for (const userId of userIds) {
      const notif = await this.createNotification({
        ...notification,
        userId
      });
      notifications.push(notif);
    }

    return notifications;
  }
}
