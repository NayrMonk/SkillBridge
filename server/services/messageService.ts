import { Pool } from 'pg';
import { RedisClientType } from 'redis';

interface CreateMessageData {
  senderId: string;
  recipientId: string;
  projectId?: string;
  contractId?: string;
  content: string;
  attachments?: string[];
}

export class MessageService {
  constructor(
    private db: Pool,
    private redis: RedisClientType
  ) {}

  async createMessage(data: CreateMessageData) {
    const result = await this.db.query(
      `INSERT INTO messages (sender_id, recipient_id, project_id, contract_id, content, attachments)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.senderId,
        data.recipientId,
        data.projectId || null,
        data.contractId || null,
        data.content,
        data.attachments || []
      ]
    );

    const message = result.rows[0];

    // Update conversation
    const participant1 = data.senderId < data.recipientId ? data.senderId : data.recipientId;
    const participant2 = data.senderId < data.recipientId ? data.recipientId : data.senderId;

    await this.db.query(
      `INSERT INTO conversations (participant_1, participant_2, project_id, last_message_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (participant_1, participant_2, project_id)
       DO UPDATE SET last_message_at = CURRENT_TIMESTAMP`,
      [participant1, participant2, data.projectId || null]
    );

    // Cache message in Redis for quick retrieval
    await this.redis.setEx(
      `message:${message.id}`,
      3600,
      JSON.stringify(message)
    );

    return message;
  }

  async getMessageById(messageId: string) {
    // Try cache first
    const cached = await this.redis.get(`message:${messageId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.db.query(
      'SELECT * FROM messages WHERE id = $1',
      [messageId]
    );

    return result.rows[0] || null;
  }

  async markAsRead(messageId: string, userId: string) {
    await this.db.query(
      `UPDATE messages 
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND recipient_id = $2`,
      [messageId, userId]
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.db.query(
      'SELECT COUNT(*) FROM messages WHERE recipient_id = $1 AND is_read = false',
      [userId]
    );

    return parseInt(result.rows[0].count);
  }

  async getConversationMessages(
    userId1: string,
    userId2: string,
    projectId?: string,
    limit: number = 50,
    offset: number = 0
  ) {
    let query = `
      SELECT 
        m.*,
        sp.display_name as sender_name,
        sp.avatar_url as sender_avatar
      FROM messages m
      JOIN profiles sp ON m.sender_id = sp.user_id
      WHERE (m.sender_id = $1 AND m.recipient_id = $2)
         OR (m.sender_id = $2 AND m.recipient_id = $1)
    `;

    const params: any[] = [userId1, userId2];

    if (projectId) {
      query += ` AND m.project_id = $3`;
      params.push(projectId);
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return result.rows.reverse();
  }

  async getConversations(userId: string) {
    const query = `
      SELECT 
        c.*,
        p1.display_name as participant_1_name,
        p1.avatar_url as participant_1_avatar,
        p2.display_name as participant_2_name,
        p2.avatar_url as participant_2_avatar,
        pr.title as project_title,
        (SELECT content FROM messages 
         WHERE (sender_id = c.participant_1 AND recipient_id = c.participant_2)
            OR (sender_id = c.participant_2 AND recipient_id = c.participant_1)
         ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages 
         WHERE (sender_id = c.participant_1 AND recipient_id = c.participant_2)
            OR (sender_id = c.participant_2 AND recipient_id = c.participant_1)
         ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM messages 
         WHERE recipient_id = $1 AND sender_id = 
           CASE WHEN c.participant_1 = $1 THEN c.participant_2 ELSE c.participant_1 END
         AND is_read = false) as unread_count
      FROM conversations c
      JOIN profiles p1 ON c.participant_1 = p1.user_id
      JOIN profiles p2 ON c.participant_2 = p2.user_id
      LEFT JOIN projects pr ON c.project_id = pr.id
      WHERE c.participant_1 = $1 OR c.participant_2 = $1
      ORDER BY c.last_message_at DESC
    `;

    const result = await this.db.query(query, [userId]);

    return result.rows.map(conv => {
      const isParticipant1 = conv.participant_1 === userId;
      return {
        id: conv.id,
        otherParticipant: {
          id: isParticipant1 ? conv.participant_2 : conv.participant_1,
          displayName: isParticipant1 ? conv.participant_2_name : conv.participant_1_name,
          avatarUrl: isParticipant1 ? conv.participant_2_avatar : conv.participant_1_avatar
        },
        project: conv.project_id ? {
          id: conv.project_id,
          title: conv.project_title
        } : null,
        lastMessage: conv.last_message,
        lastMessageAt: conv.last_message_at,
        unreadCount: parseInt(conv.unread_count),
        createdAt: conv.created_at
      };
    });
  }
}
