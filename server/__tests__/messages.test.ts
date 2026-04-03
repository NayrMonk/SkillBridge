/// <reference types="jest" />
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from './testApp';
import { db } from '../index';
import {
  freelancerToken, clientToken, adminToken,
  activeFreelancerRow, activeClientRow, activeAdminRow,
  FREELANCER_TOKEN_PAYLOAD
} from './helpers';

jest.mock('../index.ts');

const JWT_SECRET = 'your-secret-key-change-in-production';

const mockQuery = db.query as jest.Mock;
const mockConnect = db.connect as jest.Mock;
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
});

const authFreelancer = () => mockQuery.mockResolvedValueOnce({ rows: [activeFreelancerRow] });
const authClient = () => mockQuery.mockResolvedValueOnce({ rows: [activeClientRow] });
const authAdmin = () => mockQuery.mockResolvedValueOnce({ rows: [activeAdminRow] });

const expiredFreelancerToken = jwt.sign(FREELANCER_TOKEN_PAYLOAD, JWT_SECRET, { expiresIn: '-1s' });
const invalidToken = 'this.is.not.a.valid.jwt';

// ── GET /api/messages/conversations ────────────────────────────────────────

describe('GET /api/messages/conversations', () => {
  it('returns 200 with conversations list', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'conv-id', participant_1: 'freelancer-user-id', participant_2: 'client-user-id',
        participant_1_name: 'Freelancer', participant_1_avatar: null,
        participant_2_name: 'Client', participant_2_avatar: null,
        project_id: null, project_title: null,
        last_message: 'Hello', last_message_at: new Date().toISOString(),
        unread_count: '2', created_at: new Date().toISOString()
      }]
    });

    const res = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('conversations');
    expect(Array.isArray(res.body.conversations)).toBe(true);
    expect(res.body.conversations[0]).toHaveProperty('otherParticipant');
    expect(res.body.conversations[0].unreadCount).toBe(2);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/messages/conversations');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid (malformed) token', async () => {
    const res = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${expiredFreelancerToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists in DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeFreelancerRow, status: 'suspended' }] });
    const res = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });

  it('returns 500 when DB query throws during conversations fetch', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });

  it('returns empty conversations array when no conversations found', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(0);
  });

  it('resolves otherParticipant to participant_1 when current user is participant_2', async () => {
    authClient(); // client-user-id is participant_2
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'conv-id',
        participant_1: 'freelancer-user-id',
        participant_2: 'client-user-id',
        participant_1_name: 'Freelancer Alice',
        participant_1_avatar: 'https://cdn.example.com/alice.png',
        participant_2_name: 'Client Bob',
        participant_2_avatar: null,
        project_id: null, project_title: null,
        last_message: 'Hey', last_message_at: new Date().toISOString(),
        unread_count: '0', created_at: new Date().toISOString()
      }]
    });

    const res = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    const conv = res.body.conversations[0];
    // participant_2 = current user, so otherParticipant = participant_1
    expect(conv.otherParticipant.id).toBe('freelancer-user-id');
    expect(conv.otherParticipant.displayName).toBe('Freelancer Alice');
    expect(conv.otherParticipant.avatarUrl).toBe('https://cdn.example.com/alice.png');
  });

  it('includes populated project object when project_id is set', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'conv-id',
        participant_1: 'freelancer-user-id',
        participant_2: 'client-user-id',
        participant_1_name: 'Freelancer', participant_1_avatar: null,
        participant_2_name: 'Client', participant_2_avatar: null,
        project_id: 'proj-123', project_title: 'Build a marketplace',
        last_message: 'Hi', last_message_at: new Date().toISOString(),
        unread_count: '1', created_at: new Date().toISOString()
      }]
    });

    const res = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    const conv = res.body.conversations[0];
    expect(conv.project).not.toBeNull();
    expect(conv.project.id).toBe('proj-123');
    expect(conv.project.title).toBe('Build a marketplace');
  });

  it('sets project to null when project_id is not set', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'conv-id',
        participant_1: 'freelancer-user-id', participant_2: 'client-user-id',
        participant_1_name: 'Freelancer', participant_1_avatar: null,
        participant_2_name: 'Client', participant_2_avatar: null,
        project_id: null, project_title: null,
        last_message: null, last_message_at: null,
        unread_count: '0', created_at: new Date().toISOString()
      }]
    });

    const res = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations[0].project).toBeNull();
  });
});

// ── GET /api/messages/unread/count ─────────────────────────────────────────

describe('GET /api/messages/unread/count', () => {
  it('returns 200 with unread message count', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] });

    const res = await request(app)
      .get('/api/messages/unread/count')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('unreadCount', 5);
  });

  it('returns 0 when no unread messages', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const res = await request(app)
      .get('/api/messages/unread/count')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(0);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/messages/unread/count');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/messages/unread/count')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .get('/api/messages/unread/count')
      .set('Authorization', `Bearer ${expiredFreelancerToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/messages/unread/count')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeFreelancerRow, status: 'suspended' }] });
    const res = await request(app)
      .get('/api/messages/unread/count')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });

  it('returns 500 when DB throws during unread count fetch', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('Query timeout'));

    const res = await request(app)
      .get('/api/messages/unread/count')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });
});

// ── GET /api/messages/:userId ──────────────────────────────────────────────

describe('GET /api/messages/:userId', () => {
  it('returns 200 with message thread', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'msg-id', sender_id: 'freelancer-user-id', recipient_id: 'client-user-id',
          content: 'Hello client!', is_read: true, created_at: new Date().toISOString()
        }]
      }) // messages
      .mockResolvedValueOnce({ rows: [] }); // mark as read

    const res = await request(app)
      .get('/api/messages/client-user-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('messages');
    expect(res.body).toHaveProperty('pagination');
  });

  it('marks messages as read when fetched', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] }); // mark read called

    await request(app)
      .get('/api/messages/client-user-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    // 3 total queries: auth + messages + mark-as-read
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/messages/client-user-id');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/messages/client-user-id')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .get('/api/messages/client-user-id')
      .set('Authorization', `Bearer ${expiredFreelancerToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/messages/client-user-id')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeFreelancerRow, status: 'suspended' }] });
    const res = await request(app)
      .get('/api/messages/client-user-id')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });

  it('returns 500 when DB throws during messages fetch', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('Query failed'));

    const res = await request(app)
      .get('/api/messages/client-user-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });

  it('returns empty messages array when no messages found', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/messages/client-user-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(0);
  });

  it('returns messages in chronological order (oldest first)', async () => {
    authFreelancer();
    const older = { id: 'msg-1', content: 'First', created_at: '2026-01-01T10:00:00Z', sender_id: 'freelancer-user-id' };
    const newer = { id: 'msg-2', content: 'Second', created_at: '2026-01-01T11:00:00Z', sender_id: 'client-user-id' };
    // DB returns DESC order (newest first); route reverses to chronological
    mockQuery
      .mockResolvedValueOnce({ rows: [newer, older] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/messages/client-user-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.messages[0].id).toBe('msg-1');
    expect(res.body.messages[1].id).toBe('msg-2');
  });

  it('applies projectId filter when provided', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'msg-1', project_id: 'proj-abc' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/messages/client-user-id?projectId=proj-abc')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    // The query must include the project_id param
    const messagesCall = mockQuery.mock.calls[1];
    expect(messagesCall[1]).toContain('proj-abc');
  });

  it('returns correct pagination metadata with custom page and limit', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/messages/client-user-id?page=3&limit=10')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(3);
    expect(res.body.pagination.limit).toBe(10);
  });
});

// ── POST /api/messages ─────────────────────────────────────────────────────

describe('POST /api/messages', () => {
  it('returns 201 when message is sent successfully', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'client-user-id' }] }); // recipient exists

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'msg-id', content: 'Hello', sender_id: 'freelancer-user-id' }] }) // insert message
      .mockResolvedValueOnce({ rows: [] }) // upsert conversation
      .mockResolvedValueOnce({ rows: [] }) // notification
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ recipientId: 'client-user-id', content: 'Hello' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message', 'Message sent successfully');
    expect(res.body).toHaveProperty('data');
  });

  it('returns 400 when recipientId is missing', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ content: 'Hello' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('returns 400 when content is empty', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ recipientId: 'client-user-id', content: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/empty/);
  });

  it('returns 400 when sending message to yourself', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ recipientId: 'freelancer-user-id', content: 'Hello me' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/yourself/);
  });

  it('returns 404 when recipient not found', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] }); // recipient not found

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ recipientId: 'nonexistent-user', content: 'Hello' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Recipient not found');
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .post('/api/messages')
      .send({ recipientId: 'client-user-id', content: 'Hello' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${invalidToken}`)
      .send({ recipientId: 'client-user-id', content: 'Hello' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${expiredFreelancerToken}`)
      .send({ recipientId: 'client-user-id', content: 'Hello' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ recipientId: 'client-user-id', content: 'Hello' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeFreelancerRow, status: 'suspended' }] });
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ recipientId: 'client-user-id', content: 'Hello' });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });

  it('rolls back transaction and returns 500 when message INSERT throws', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'client-user-id' }] });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce(new Error('Message insert failed')); // INSERT fails

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ recipientId: 'client-user-id', content: 'Hello' });

    expect(res.status).toBe(500);
    // ROLLBACK must have been called
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    // connection must be released even on error
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('rolls back and releases connection when conversation upsert throws', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'client-user-id' }] });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'msg-id' }] }) // insert message succeeds
      .mockRejectedValueOnce(new Error('Conversation upsert failed')); // upsert fails

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ recipientId: 'client-user-id', content: 'Hello' });

    expect(res.status).toBe(500);
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('rolls back and releases connection when notification INSERT throws', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'client-user-id' }] });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })                                    // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'msg-id' }] })                   // insert message
      .mockResolvedValueOnce({ rows: [] })                                    // conversation upsert
      .mockRejectedValueOnce(new Error('Notification insert failed'));        // notification fails

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ recipientId: 'client-user-id', content: 'Hello' });

    expect(res.status).toBe(500);
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('passes projectId and contractId through to the INSERT when provided', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'client-user-id' }] });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'msg-id', content: 'Work update', sender_id: 'freelancer-user-id' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ recipientId: 'client-user-id', content: 'Work update', projectId: 'proj-xyz', contractId: 'contract-abc' });

    expect(res.status).toBe(201);
    // The INSERT call (second client query) must bind both ids
    const insertCall = mockClientQuery.mock.calls[1];
    expect(insertCall[1]).toContain('proj-xyz');
    expect(insertCall[1]).toContain('contract-abc');
  });

  it('passes attachments array through to the INSERT when provided', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'client-user-id' }] });

    const attachments = [{ url: 'https://cdn.example.com/file.pdf', name: 'file.pdf' }];

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'msg-id', content: 'See attached', sender_id: 'freelancer-user-id' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ recipientId: 'client-user-id', content: 'See attached', attachments });

    expect(res.status).toBe(201);
    const insertCall = mockClientQuery.mock.calls[1];
    expect(insertCall[1]).toContainEqual(attachments);
  });

  it('defaults attachments to [] when not provided', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'client-user-id' }] });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'msg-id', content: 'Hi', sender_id: 'freelancer-user-id' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ recipientId: 'client-user-id', content: 'Hi' });

    expect(res.status).toBe(201);
    const insertCall = mockClientQuery.mock.calls[1];
    expect(insertCall[1]).toContainEqual([]);
  });
});
