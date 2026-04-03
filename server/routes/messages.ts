import { Router } from 'express';
import { db } from '../index.ts';
import { AuthRequest } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';

const router = Router();

// Get my conversations
router.get('/conversations', asyncHandler(async (req: AuthRequest, res) => {
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

  const result = await db.query(query, [req.user!.userId]);

  // Format conversations with other participant info
  const conversations = result.rows.map(conv => {
    const isParticipant1 = conv.participant_1 === req.user!.userId;
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

  res.json({ conversations });
}));

// Get messages with a user
router.get('/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const { projectId, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let query = `
    SELECT 
      m.*,
      sp.display_name as sender_name,
      sp.avatar_url as sender_avatar,
      rp.display_name as recipient_name,
      rp.avatar_url as recipient_avatar
    FROM messages m
    JOIN profiles sp ON m.sender_id = sp.user_id
    JOIN profiles rp ON m.recipient_id = rp.user_id
    WHERE (m.sender_id = $1 AND m.recipient_id = $2)
       OR (m.sender_id = $2 AND m.recipient_id = $1)
  `;

  const params: any[] = [req.user!.userId, userId];
  let paramIndex = 3;

  if (projectId) {
    query += ` AND m.project_id = $${paramIndex}`;
    params.push(projectId);
    paramIndex++;
  }

  query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(Number(limit), offset);

  const result = await db.query(query, params);

  // Mark messages as read
  await db.query(
    `UPDATE messages SET is_read = true, read_at = CURRENT_TIMESTAMP
     WHERE recipient_id = $1 AND sender_id = $2 AND is_read = false`,
    [req.user!.userId, userId]
  );

  res.json({
    messages: result.rows.reverse(), // Return in chronological order
    pagination: {
      page: Number(page),
      limit: Number(limit)
    }
  });
}));

// Send message
router.post('/', asyncHandler(async (req: AuthRequest, res) => {
  const { recipientId, projectId, contractId, content, attachments } = req.body;

  if (!recipientId || !content) {
    return res.status(400).json({
      error: 'Recipient ID and content are required'
    });
  }

  if (content.trim().length === 0) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  if (recipientId === req.user!.userId) {
    return res.status(400).json({ error: 'Cannot send message to yourself' });
  }

  // Verify recipient exists
  const recipientResult = await db.query(
    'SELECT id FROM users WHERE id = $1 AND status = $2',
    [recipientId, 'active']
  );

  if (recipientResult.rows.length === 0) {
    return res.status(404).json({ error: 'Recipient not found' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Create message
    const messageResult = await client.query(
      `INSERT INTO messages (sender_id, recipient_id, project_id, contract_id, content, attachments)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.user!.userId,
        recipientId,
        projectId || null,
        contractId || null,
        content.trim(),
        attachments || []
      ]
    );

    const message = messageResult.rows[0];

    // Update or create conversation
    const participant1 = req.user!.userId < recipientId ? req.user!.userId : recipientId;
    const participant2 = req.user!.userId < recipientId ? recipientId : req.user!.userId;

    await client.query(
      `INSERT INTO conversations (participant_1, participant_2, project_id, last_message_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (participant_1, participant_2, project_id)
       DO UPDATE SET last_message_at = CURRENT_TIMESTAMP`,
      [participant1, participant2, projectId || null]
    );

    // Create notification
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        recipientId,
        'new_message',
        'New Message',
        'You have received a new message',
        JSON.stringify({
          messageId: message.id,
          senderId: req.user!.userId,
          projectId: projectId || null
        })
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Get unread message count
router.get('/unread/count', asyncHandler(async (req: AuthRequest, res) => {
  const result = await db.query(
    'SELECT COUNT(*) FROM messages WHERE recipient_id = $1 AND is_read = false',
    [req.user!.userId]
  );

  res.json({
    unreadCount: parseInt(result.rows[0].count)
  });
}));

export default router;
