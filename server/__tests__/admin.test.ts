import request from 'supertest';
import { app } from './testApp';
import { db } from '../index';
import {
  adminToken, freelancerToken, clientToken,
  activeAdminRow, activeFreelancerRow, activeClientRow
} from './helpers';

jest.mock('../index.ts');

const mockQuery = db.query as jest.Mock;
const mockConnect = db.connect as jest.Mock;
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();

beforeEach(() => {
  mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
});

const authAdmin = () => mockQuery.mockResolvedValueOnce({ rows: [activeAdminRow] });
const authFreelancer = () => mockQuery.mockResolvedValueOnce({ rows: [activeFreelancerRow] });
const authClient = () => mockQuery.mockResolvedValueOnce({ rows: [activeClientRow] });

// ── GET /api/admin/stats ───────────────────────────────────────────────────

describe('GET /api/admin/stats', () => {
  it('returns 200 with platform stats for admin', async () => {
    authAdmin();
    // Admin stats uses Promise.all with 10 queries
    for (let i = 0; i < 10; i++) {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '5', total: '1000' }] });
    }

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('stats');
    expect(res.body.stats).toHaveProperty('totalUsers');
    expect(res.body.stats).toHaveProperty('totalProjects');
  });

  it('returns 403 when freelancer accesses admin stats', async () => {
    authFreelancer();

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 when client accesses admin stats', async () => {
    authClient();

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/admin/users ───────────────────────────────────────────────────

describe('GET /api/admin/users', () => {
  it('returns 200 with users list', async () => {
    authAdmin();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'user@example.com', role: 'freelancer' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
    expect(res.body).toHaveProperty('pagination');
  });

  it('returns 403 for non-admin', async () => {
    authFreelancer();

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(403);
  });
});

// ── PATCH /api/admin/users/:id/status ─────────────────────────────────────

describe('PATCH /api/admin/users/:id/status', () => {
  it('returns 200 when user status is updated', async () => {
    authAdmin();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // update user
      .mockResolvedValueOnce({ rows: [] }) // log action
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended', reason: 'Violation of terms' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'User status updated successfully');
  });

  it('returns 400 for invalid status', async () => {
    authAdmin();

    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'deleted' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid status');
  });
});

// ── GET /api/admin/projects ────────────────────────────────────────────────

describe('GET /api/admin/projects', () => {
  it('returns 200 with projects list', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p1', title: 'Test Project' }] });

    const res = await request(app)
      .get('/api/admin/projects')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('projects');
  });
});

// ── PATCH /api/admin/projects/:id/status ──────────────────────────────────

describe('PATCH /api/admin/projects/:id/status', () => {
  it('returns 200 when project status updated', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/admin/projects/project-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'open' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Project status updated successfully');
  });

  it('returns 400 for invalid project status', async () => {
    authAdmin();

    const res = await request(app)
      .patch('/api/admin/projects/project-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_review' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid status');
  });
});

// ── GET /api/admin/transactions ────────────────────────────────────────────

describe('GET /api/admin/transactions', () => {
  it('returns 200 with transactions list', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'tx1', type: 'deposit', amount: 100 }] });

    const res = await request(app)
      .get('/api/admin/transactions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('transactions');
  });
});

// ── GET /api/admin/disputes ────────────────────────────────────────────────

describe('GET /api/admin/disputes', () => {
  it('returns 200 with disputes list', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'd1', status: 'open' }] });

    const res = await request(app)
      .get('/api/admin/disputes')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('disputes');
  });

  it('filters disputes by status', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'd2', status: 'resolved' }] });

    const res = await request(app)
      .get('/api/admin/disputes?status=resolved')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.disputes).toHaveLength(1);
  });
});

// ── POST /api/admin/disputes/:id/resolve ──────────────────────────────────

describe('POST /api/admin/disputes/:id/resolve', () => {
  it('returns 200 when dispute is resolved', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/admin/disputes/dispute-id/resolve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ resolution: 'Refund issued', action: 'refund' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Dispute resolved successfully');
  });
});

// ── GET /api/admin/settings ────────────────────────────────────────────────

describe('GET /api/admin/settings', () => {
  it('returns 200 with platform settings', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({
      rows: [
        { key: 'platform_fee_percentage', value: '10' },
        { key: 'hot_project_price', value: '49.99' }
      ]
    });

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('settings');
    expect(res.body.settings).toHaveLength(2);
  });
});

// ── PUT /api/admin/settings/:key ──────────────────────────────────────────

describe('PUT /api/admin/settings/:key', () => {
  it('returns 200 when setting is updated', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/admin/settings/platform_fee_percentage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: '12', description: 'Updated platform fee' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Setting updated successfully');
  });
});

// ── GET /api/admin/logs ────────────────────────────────────────────────────

describe('GET /api/admin/logs', () => {
  it('returns 200 with admin action logs', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'log-1', action_type: 'update_user_status', admin_name: 'Admin User' }]
    });

    const res = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('logs');
  });
});
