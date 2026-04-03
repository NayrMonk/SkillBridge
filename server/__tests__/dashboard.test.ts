import request from 'supertest';
import { app } from './testApp';
import { db } from '../index';
import {
  freelancerToken, clientToken, adminToken,
  activeFreelancerRow, activeClientRow, activeAdminRow
} from './helpers';

jest.mock('../index.ts');

const mockQuery = db.query as jest.Mock;
const mockConnect = db.connect as jest.Mock;

beforeEach(() => {
  mockConnect.mockResolvedValue({ query: jest.fn(), release: jest.fn() });
});

const authFreelancer = () => mockQuery.mockResolvedValueOnce({ rows: [activeFreelancerRow] });
const authClient = () => mockQuery.mockResolvedValueOnce({ rows: [activeClientRow] });
const authAdmin = () => mockQuery.mockResolvedValueOnce({ rows: [activeAdminRow] });

const emptyCountRow = { rows: [{ count: '0', total: '0' }] };
const emptyRows = { rows: [] };

// ── GET /api/dashboard/freelancer ──────────────────────────────────────────

describe('GET /api/dashboard/freelancer', () => {
  it('returns 200 with freelancer dashboard data', async () => {
    authFreelancer();
    // 8 parallel queries from Promise.all
    for (let i = 0; i < 8; i++) {
      mockQuery.mockResolvedValueOnce(emptyCountRow);
    }

    const res = await request(app)
      .get('/api/dashboard/freelancer')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dashboard');
    expect(res.body.dashboard).toHaveProperty('stats');
    expect(res.body.dashboard.stats).toHaveProperty('totalEarnings');
    expect(res.body.dashboard.stats).toHaveProperty('activeJobs');
    expect(res.body.dashboard.stats).toHaveProperty('pendingApplications');
    expect(res.body.dashboard.stats).toHaveProperty('unreadMessages');
  });

  it('returns 403 when client accesses freelancer dashboard', async () => {
    authClient();

    const res = await request(app)
      .get('/api/dashboard/freelancer')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Access denied');
  });

  it('returns 401 when no token', async () => {
    const res = await request(app).get('/api/dashboard/freelancer');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/dashboard/client ──────────────────────────────────────────────

describe('GET /api/dashboard/client', () => {
  it('returns 200 with client dashboard data', async () => {
    authClient();
    for (let i = 0; i < 8; i++) {
      mockQuery.mockResolvedValueOnce(emptyCountRow);
    }

    const res = await request(app)
      .get('/api/dashboard/client')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dashboard');
    expect(res.body.dashboard).toHaveProperty('stats');
    expect(res.body.dashboard.stats).toHaveProperty('totalSpent');
    expect(res.body.dashboard.stats).toHaveProperty('activeProjects');
    expect(res.body.dashboard.stats).toHaveProperty('totalProjects');
    expect(res.body.dashboard.stats).toHaveProperty('unreadMessages');
  });

  it('returns 403 when freelancer accesses client dashboard', async () => {
    authFreelancer();

    const res = await request(app)
      .get('/api/dashboard/client')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Access denied');
  });
});

// ── GET /api/dashboard/notifications ──────────────────────────────────────

describe('GET /api/dashboard/notifications', () => {
  it('returns 200 with notifications', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'n1', type: 'welcome', title: 'Welcome!', is_read: false }]
      }) // notifications
      .mockResolvedValueOnce({ rows: [{ count: '3' }] }); // unread count

    const res = await request(app)
      .get('/api/dashboard/notifications')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('notifications');
    expect(res.body).toHaveProperty('unreadCount', 3);
  });

  it('filters unread notifications when unreadOnly=true', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'n2', type: 'new_message', is_read: false }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/dashboard/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
  });

  it('returns 401 when no token', async () => {
    const res = await request(app).get('/api/dashboard/notifications');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/dashboard/notifications/:id/read ───────────────────────────

describe('PATCH /api/dashboard/notifications/:id/read', () => {
  it('returns 200 when notification is marked as read', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/dashboard/notifications/notification-id/read')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Notification marked as read');
  });

  it('returns 401 when no token', async () => {
    const res = await request(app)
      .patch('/api/dashboard/notifications/notification-id/read');
    expect(res.status).toBe(401);
  });
});

// ── POST /api/dashboard/notifications/read-all ────────────────────────────

describe('POST /api/dashboard/notifications/read-all', () => {
  it('returns 200 when all notifications marked as read', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/dashboard/notifications/read-all')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'All notifications marked as read');
  });

  it('returns 401 when no token', async () => {
    const res = await request(app).post('/api/dashboard/notifications/read-all');
    expect(res.status).toBe(401);
  });
});
