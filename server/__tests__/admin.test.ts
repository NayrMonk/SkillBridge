/// <reference types="jest" />
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from './testApp';
import { db } from '../index';
import {
  adminToken, freelancerToken, clientToken,
  activeAdminRow, activeFreelancerRow, activeClientRow,
  ADMIN_TOKEN_PAYLOAD
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

const authAdmin = () => mockQuery.mockResolvedValueOnce({ rows: [activeAdminRow] });
const authFreelancer = () => mockQuery.mockResolvedValueOnce({ rows: [activeFreelancerRow] });
const authClient = () => mockQuery.mockResolvedValueOnce({ rows: [activeClientRow] });

const expiredAdminToken = jwt.sign(ADMIN_TOKEN_PAYLOAD, JWT_SECRET, { expiresIn: '-1s' });
const invalidToken = 'this.is.not.a.valid.jwt';
const wrongSecretToken = jwt.sign(ADMIN_TOKEN_PAYLOAD, 'wrong-secret');

// ── GET /api/admin/stats ───────────────────────────────────────────────────────

describe('GET /api/admin/stats', () => {
  it('returns 200 with platform stats for admin', async () => {
    authAdmin();
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
    expect(res.body.stats).toHaveProperty('totalTransactions');
    expect(res.body.stats).toHaveProperty('totalVolume');
    expect(res.body.stats).toHaveProperty('activeContracts');
    expect(res.body.stats).toHaveProperty('pendingApplications');
    expect(res.body.stats).toHaveProperty('recentUsers');
    expect(res.body.stats).toHaveProperty('recentProjects');
  });

  it('returns 403 when freelancer accesses admin stats', async () => {
    authFreelancer();

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 403 when client accesses admin stats', async () => {
    authClient();

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid (malformed) token', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${expiredAdminToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists in DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeAdminRow, status: 'suspended' }] });
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });

  it('returns 500 when DB query throws during stats fetch', async () => {
    authAdmin();
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
  });
});

// ── GET /api/admin/users ───────────────────────────────────────────────────────

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
    expect(res.body.pagination).toHaveProperty('page');
    expect(res.body.pagination).toHaveProperty('limit');
    expect(res.body.pagination).toHaveProperty('total');
    expect(res.body.pagination).toHaveProperty('totalPages');
  });

  it('returns 403 for freelancer', async () => {
    authFreelancer();
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 403 for client', async () => {
    authClient();
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${expiredAdminToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeAdminRow, status: 'suspended' }] });
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('applies role filter query param', async () => {
    authAdmin();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'u1', role: 'freelancer' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/admin/users?role=freelancer')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users[0].role).toBe('freelancer');
  });

  it('applies status filter query param', async () => {
    authAdmin();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'u2', status: 'suspended' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/admin/users?status=suspended')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users[0].status).toBe('suspended');
  });

  it('applies search filter query param', async () => {
    authAdmin();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'u3', email: 'alice@example.com' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/admin/users?search=alice')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
  });

  it('respects page and limit pagination params', async () => {
    authAdmin();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '100' }] });

    const res = await request(app)
      .get('/api/admin/users?page=3&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(3);
    expect(res.body.pagination.limit).toBe(10);
    expect(res.body.pagination.total).toBe(100);
    expect(res.body.pagination.totalPages).toBe(10);
  });

  it('returns empty users array when no users found', async () => {
    authAdmin();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
    expect(res.body.pagination.totalPages).toBe(0);
  });

  it('returns 500 when DB throws during users query', async () => {
    authAdmin();
    mockQuery.mockRejectedValueOnce(new Error('Query timeout'));

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
  });
});

// ── PATCH /api/admin/users/:id/status ─────────────────────────────────────────

describe('PATCH /api/admin/users/:id/status', () => {
  it('returns 200 when user status is updated to suspended', async () => {
    authAdmin();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // UPDATE users
      .mockResolvedValueOnce({ rows: [] }) // INSERT admin_actions
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended', reason: 'Violation of terms' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'User status updated successfully');
  });

  it('returns 200 when user status is updated to active', async () => {
    authAdmin();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active', reason: 'Appeal approved' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'User status updated successfully');
  });

  it('returns 200 when user status is updated to banned', async () => {
    authAdmin();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'banned', reason: 'Repeated violations' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'User status updated successfully');
  });

  it('returns 400 for invalid status value', async () => {
    authAdmin();

    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'deleted' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid status');
  });

  it('returns 400 when status is missing from body', async () => {
    authAdmin();

    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'some reason' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid status');
  });

  it('returns 400 when status is an empty string', async () => {
    authAdmin();

    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: '' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid status');
  });

  it('returns 400 when body is empty', async () => {
    authAdmin();

    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid status');
  });

  it('returns 403 for freelancer', async () => {
    authFreelancer();

    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ status: 'suspended' });

    expect(res.status).toBe(403);
  });

  it('returns 403 for client', async () => {
    authClient();

    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'suspended' });

    expect(res.status).toBe(403);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .send({ status: 'suspended' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .set('Authorization', `Bearer ${invalidToken}`)
      .send({ status: 'suspended' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .set('Authorization', `Bearer ${expiredAdminToken}`)
      .send({ status: 'suspended' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('rolls back transaction and returns 500 when UPDATE query throws', async () => {
    authAdmin();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce(new Error('FK constraint violation')); // UPDATE fails

    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended', reason: 'Test' });

    expect(res.status).toBe(500);
    // ROLLBACK must have been called
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    // connection must be released even on error
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('rolls back and releases connection when admin_actions INSERT throws', async () => {
    authAdmin();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // UPDATE users succeeds
      .mockRejectedValueOnce(new Error('admin_actions insert failed')); // INSERT fails

    const res = await request(app)
      .patch('/api/admin/users/user-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended', reason: 'Test' });

    expect(res.status).toBe(500);
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClientRelease).toHaveBeenCalled();
  });
});

// ── GET /api/admin/projects ────────────────────────────────────────────────────

describe('GET /api/admin/projects', () => {
  it('returns 200 with projects list', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p1', title: 'Test Project' }] });

    const res = await request(app)
      .get('/api/admin/projects')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('projects');
    expect(res.body).toHaveProperty('pagination');
  });

  it('returns 403 for freelancer', async () => {
    authFreelancer();
    const res = await request(app)
      .get('/api/admin/projects')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 403 for client', async () => {
    authClient();
    const res = await request(app)
      .get('/api/admin/projects')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/admin/projects');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/admin/projects')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .get('/api/admin/projects')
      .set('Authorization', `Bearer ${expiredAdminToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/admin/projects')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeAdminRow, status: 'suspended' }] });
    const res = await request(app)
      .get('/api/admin/projects')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('applies status filter query param', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p2', status: 'cancelled' }] });

    const res = await request(app)
      .get('/api/admin/projects?status=cancelled')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.projects[0].status).toBe('cancelled');
  });

  it('respects page and limit pagination params', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/admin/projects?page=2&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(5);
  });

  it('returns empty projects array when no projects found', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/admin/projects')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(0);
  });

  it('returns 500 when DB throws during projects query', async () => {
    authAdmin();
    mockQuery.mockRejectedValueOnce(new Error('Query failed'));

    const res = await request(app)
      .get('/api/admin/projects')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
  });
});

// ── PATCH /api/admin/projects/:id/status ──────────────────────────────────────

describe('PATCH /api/admin/projects/:id/status', () => {
  it('returns 200 when project status updated to open', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/admin/projects/project-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'open' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Project status updated successfully');
  });

  it('returns 200 when project status updated to cancelled', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/admin/projects/project-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' });

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

  it('returns 400 when status is missing from body', async () => {
    authAdmin();

    const res = await request(app)
      .patch('/api/admin/projects/project-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid status');
  });

  it('returns 400 when status is an empty string', async () => {
    authAdmin();

    const res = await request(app)
      .patch('/api/admin/projects/project-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: '' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid status');
  });

  it('returns 403 for freelancer', async () => {
    authFreelancer();
    const res = await request(app)
      .patch('/api/admin/projects/project-id/status')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ status: 'open' });
    expect(res.status).toBe(403);
  });

  it('returns 403 for client', async () => {
    authClient();
    const res = await request(app)
      .patch('/api/admin/projects/project-id/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'open' });
    expect(res.status).toBe(403);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .patch('/api/admin/projects/project-id/status')
      .send({ status: 'open' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .patch('/api/admin/projects/project-id/status')
      .set('Authorization', `Bearer ${invalidToken}`)
      .send({ status: 'open' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .patch('/api/admin/projects/project-id/status')
      .set('Authorization', `Bearer ${expiredAdminToken}`)
      .send({ status: 'open' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .patch('/api/admin/projects/project-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'open' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 500 when DB throws during update', async () => {
    authAdmin();
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .patch('/api/admin/projects/project-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'open' });

    expect(res.status).toBe(500);
  });
});

// ── GET /api/admin/transactions ────────────────────────────────────────────────

describe('GET /api/admin/transactions', () => {
  it('returns 200 with transactions list', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'tx1', type: 'deposit', amount: 100 }] });

    const res = await request(app)
      .get('/api/admin/transactions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('transactions');
    expect(res.body).toHaveProperty('pagination');
  });

  it('returns 403 for freelancer', async () => {
    authFreelancer();
    const res = await request(app)
      .get('/api/admin/transactions')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 403 for client', async () => {
    authClient();
    const res = await request(app)
      .get('/api/admin/transactions')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/admin/transactions');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/admin/transactions')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .get('/api/admin/transactions')
      .set('Authorization', `Bearer ${expiredAdminToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/admin/transactions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeAdminRow, status: 'suspended' }] });
    const res = await request(app)
      .get('/api/admin/transactions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('applies type filter query param', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'tx2', type: 'withdrawal' }] });

    const res = await request(app)
      .get('/api/admin/transactions?type=withdrawal')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.transactions[0].type).toBe('withdrawal');
  });

  it('applies status filter query param', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'tx3', status: 'pending' }] });

    const res = await request(app)
      .get('/api/admin/transactions?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.transactions[0].status).toBe('pending');
  });

  it('applies both type and status filters simultaneously', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'tx4', type: 'deposit', status: 'completed' }] });

    const res = await request(app)
      .get('/api/admin/transactions?type=deposit&status=completed')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('transactions');
  });

  it('respects page and limit pagination params', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/admin/transactions?page=2&limit=25')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(25);
  });

  it('returns empty transactions array when none found', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/admin/transactions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(0);
  });

  it('returns 500 when DB throws during transactions query', async () => {
    authAdmin();
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .get('/api/admin/transactions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
  });
});

// ── GET /api/admin/disputes ────────────────────────────────────────────────────

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
    expect(res.body.disputes[0].status).toBe('resolved');
  });

  it('returns empty disputes array when none match filter', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/admin/disputes?status=in_review')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.disputes).toHaveLength(0);
  });

  it('returns 403 for freelancer', async () => {
    authFreelancer();
    const res = await request(app)
      .get('/api/admin/disputes')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 403 for client', async () => {
    authClient();
    const res = await request(app)
      .get('/api/admin/disputes')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/admin/disputes');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/admin/disputes')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .get('/api/admin/disputes')
      .set('Authorization', `Bearer ${expiredAdminToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/admin/disputes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeAdminRow, status: 'suspended' }] });
    const res = await request(app)
      .get('/api/admin/disputes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 500 when DB throws during disputes query', async () => {
    authAdmin();
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .get('/api/admin/disputes')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
  });
});

// ── POST /api/admin/disputes/:id/resolve ──────────────────────────────────────

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

  it('returns 200 when resolved without an action field', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/admin/disputes/dispute-id/resolve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ resolution: 'No action needed' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Dispute resolved successfully');
  });

  it('returns 200 when body is empty (resolution stored as null)', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/admin/disputes/dispute-id/resolve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    // Route does not validate presence of resolution — DB receives null
    expect(res.status).toBe(200);
  });

  it('returns 403 for freelancer', async () => {
    authFreelancer();
    const res = await request(app)
      .post('/api/admin/disputes/dispute-id/resolve')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ resolution: 'Refund issued', action: 'refund' });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 403 for client', async () => {
    authClient();
    const res = await request(app)
      .post('/api/admin/disputes/dispute-id/resolve')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ resolution: 'Refund issued' });
    expect(res.status).toBe(403);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .post('/api/admin/disputes/dispute-id/resolve')
      .send({ resolution: 'Refund issued' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .post('/api/admin/disputes/dispute-id/resolve')
      .set('Authorization', `Bearer ${invalidToken}`)
      .send({ resolution: 'Refund issued' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .post('/api/admin/disputes/dispute-id/resolve')
      .set('Authorization', `Bearer ${expiredAdminToken}`)
      .send({ resolution: 'Refund issued' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/admin/disputes/dispute-id/resolve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ resolution: 'Refund issued' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeAdminRow, status: 'suspended' }] });
    const res = await request(app)
      .post('/api/admin/disputes/dispute-id/resolve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ resolution: 'Refund issued' });
    expect(res.status).toBe(403);
  });

  it('returns 500 when DB throws during resolve update', async () => {
    authAdmin();
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post('/api/admin/disputes/dispute-id/resolve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ resolution: 'Refund issued', action: 'refund' });

    expect(res.status).toBe(500);
  });
});

// ── GET /api/admin/settings ────────────────────────────────────────────────────

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

  it('returns 200 with empty settings array when table is empty', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.settings).toHaveLength(0);
  });

  it('returns 403 for freelancer', async () => {
    authFreelancer();
    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 403 for client', async () => {
    authClient();
    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/admin/settings');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${expiredAdminToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeAdminRow, status: 'suspended' }] });
    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 500 when DB throws during settings fetch', async () => {
    authAdmin();
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
  });
});

// ── PUT /api/admin/settings/:key ──────────────────────────────────────────────

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

  it('returns 200 when setting is inserted or updated without description', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/admin/settings/hot_project_price')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: '59.99' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Setting updated successfully');
  });

  it('returns 200 when setting is created for a new key', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/admin/settings/new_custom_setting')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 'true', description: 'Custom feature flag' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Setting updated successfully');
  });

  it('returns 403 for freelancer', async () => {
    authFreelancer();
    const res = await request(app)
      .put('/api/admin/settings/platform_fee_percentage')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ value: '15' });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 403 for client', async () => {
    authClient();
    const res = await request(app)
      .put('/api/admin/settings/platform_fee_percentage')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ value: '15' });
    expect(res.status).toBe(403);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .put('/api/admin/settings/platform_fee_percentage')
      .send({ value: '15' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .put('/api/admin/settings/platform_fee_percentage')
      .set('Authorization', `Bearer ${invalidToken}`)
      .send({ value: '15' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .put('/api/admin/settings/platform_fee_percentage')
      .set('Authorization', `Bearer ${expiredAdminToken}`)
      .send({ value: '15' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .put('/api/admin/settings/platform_fee_percentage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: '15' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeAdminRow, status: 'suspended' }] });
    const res = await request(app)
      .put('/api/admin/settings/platform_fee_percentage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: '15' });
    expect(res.status).toBe(403);
  });

  it('returns 500 when DB throws during upsert', async () => {
    authAdmin();
    mockQuery.mockRejectedValueOnce(new Error('constraint violation'));

    const res = await request(app)
      .put('/api/admin/settings/platform_fee_percentage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: '15' });

    expect(res.status).toBe(500);
  });
});

// ── GET /api/admin/logs ────────────────────────────────────────────────────────

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
    expect(res.body.logs).toHaveLength(1);
    expect(res.body.logs[0]).toHaveProperty('action_type', 'update_user_status');
  });

  it('returns 200 with empty logs array when no logs exist', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.logs).toHaveLength(0);
  });

  it('respects page and limit pagination params', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'log-2', action_type: 'update_project_status', admin_name: 'Admin User' }]
    });

    const res = await request(app)
      .get('/api/admin/logs?page=2&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // Verify the query was called with correct LIMIT/OFFSET values
    const lastCall = mockQuery.mock.calls[mockQuery.mock.calls.length - 1];
    expect(lastCall[1]).toEqual([10, 10]); // limit=10, offset=(2-1)*10=10
  });

  it('uses default page=1 limit=50 when no params given', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const lastCall = mockQuery.mock.calls[mockQuery.mock.calls.length - 1];
    expect(lastCall[1]).toEqual([50, 0]); // default limit=50, offset=0
  });

  it('returns 403 for freelancer', async () => {
    authFreelancer();
    const res = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 403 for client', async () => {
    authClient();
    const res = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/admin/logs');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${expiredAdminToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeAdminRow, status: 'suspended' }] });
    const res = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 500 when DB throws during logs query', async () => {
    authAdmin();
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
  });
});
