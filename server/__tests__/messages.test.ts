/// <reference types="jest" />
import request from 'supertest';
import { app } from './testApp';
import { db } from '../index';
import {
  freelancerToken, clientToken,
  activeFreelancerRow, activeClientRow
} from './helpers';

jest.mock('../index.ts');

const mockQuery = db.query as jest.Mock;
const mockConnect = db.connect as jest.Mock;
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();

beforeEach(() => {
  mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
});

const authFreelancer = () => mockQuery.mockResolvedValueOnce({ rows: [activeFreelancerRow] });
const authClient = () => mockQuery.mockResolvedValueOnce({ rows: [activeClientRow] });

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
});
