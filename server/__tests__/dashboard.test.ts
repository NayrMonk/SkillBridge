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

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue({ query: jest.fn(), release: jest.fn() });
});

const authFreelancer = () => mockQuery.mockResolvedValueOnce({ rows: [activeFreelancerRow] });
const authClient    = () => mockQuery.mockResolvedValueOnce({ rows: [activeClientRow] });
const authAdmin     = () => mockQuery.mockResolvedValueOnce({ rows: [activeAdminRow] });

const expiredToken = jwt.sign(FREELANCER_TOKEN_PAYLOAD, JWT_SECRET, { expiresIn: '-1s' });
const invalidToken = 'not.a.valid.jwt';

// Queue all 8 Promise.all queries for the freelancer dashboard
const queueFreelancerDashboardQueries = () => {
  // earnings (total), activeJobs (count), appliedJobs (count), unreadMessages (count)
  // recentApplications (rows), upcomingDeadlines (rows), skillsProgress (rows), weeklyEarnings (rows)
  mockQuery
    .mockResolvedValueOnce({ rows: [{ total: '1250.50' }] })
    .mockResolvedValueOnce({ rows: [{ count: '3' }] })
    .mockResolvedValueOnce({ rows: [{ count: '5' }] })
    .mockResolvedValueOnce({ rows: [{ count: '2' }] })
    .mockResolvedValueOnce({ rows: [{ id: 'app-1', project_title: 'Build a website' }] })
    .mockResolvedValueOnce({ rows: [{ id: 'c-1', project_title: 'API project', deadline: new Date().toISOString() }] })
    .mockResolvedValueOnce({ rows: [{ name: 'React', category: 'Web', proficiency_level: 5 }] })
    .mockResolvedValueOnce({ rows: [{ week: new Date().toISOString(), earnings: '400' }] });
};

// Queue all 8 Promise.all queries for the client dashboard
const queueClientDashboardQueries = () => {
  // totalSpent, activeProjects, totalProjects, unreadMessages,
  // recentProjects, pendingApplications, activeContracts, monthlySpending
  mockQuery
    .mockResolvedValueOnce({ rows: [{ total: '5000.00' }] })
    .mockResolvedValueOnce({ rows: [{ count: '2' }] })
    .mockResolvedValueOnce({ rows: [{ count: '8' }] })
    .mockResolvedValueOnce({ rows: [{ count: '1' }] })
    .mockResolvedValueOnce({ rows: [{ id: 'proj-1', title: 'Landing page', application_count: '3' }] })
    .mockResolvedValueOnce({ rows: [{ id: 'app-2', project_title: 'API', freelancer_name: 'Dev' }] })
    .mockResolvedValueOnce({ rows: [{ id: 'c-2', project_title: 'Backend', freelancer_name: 'Jane' }] })
    .mockResolvedValueOnce({ rows: [{ month: new Date().toISOString(), spending: '1000' }] });
};

// ── GET /api/dashboard/freelancer ──────────────────────────────────────────

describe('GET /api/dashboard/freelancer', () => {
  it('returns 200 with full freelancer dashboard structure', async () => {
    authFreelancer();
    queueFreelancerDashboardQueries();

    const res = await request(app)
      .get('/api/dashboard/freelancer')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dashboard');

    const { stats, recentApplications, upcomingDeadlines, skillsProgress, weeklyEarnings } = res.body.dashboard;
    expect(stats).toHaveProperty('totalEarnings');
    expect(stats).toHaveProperty('activeJobs');
    expect(stats).toHaveProperty('pendingApplications');
    expect(stats).toHaveProperty('unreadMessages');
    expect(Array.isArray(recentApplications)).toBe(true);
    expect(Array.isArray(upcomingDeadlines)).toBe(true);
    expect(Array.isArray(skillsProgress)).toBe(true);
    expect(Array.isArray(weeklyEarnings)).toBe(true);
  });

  it('parses totalEarnings as a float', async () => {
    authFreelancer();
    queueFreelancerDashboardQueries();

    const res = await request(app)
      .get('/api/dashboard/freelancer')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.body.dashboard.stats.totalEarnings).toBe(1250.50);
  });

  it('parses activeJobs, pendingApplications, unreadMessages as integers', async () => {
    authFreelancer();
    queueFreelancerDashboardQueries();

    const res = await request(app)
      .get('/api/dashboard/freelancer')
      .set('Authorization', `Bearer ${freelancerToken}`);

    const { activeJobs, pendingApplications, unreadMessages } = res.body.dashboard.stats;
    expect(Number.isInteger(activeJobs)).toBe(true);
    expect(Number.isInteger(pendingApplications)).toBe(true);
    expect(Number.isInteger(unreadMessages)).toBe(true);
  });

  it('defaults stats to 0 when DB rows have no values', async () => {
    authFreelancer();
    // All 8 queries return empty/null aggregates
    for (let i = 0; i < 8; i++) {
      mockQuery.mockResolvedValueOnce({ rows: [{ total: null, count: null }] });
    }

    const res = await request(app)
      .get('/api/dashboard/freelancer')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    const { stats } = res.body.dashboard;
    expect(stats.totalEarnings).toBe(0);
    expect(stats.activeJobs).toBe(0);
    expect(stats.pendingApplications).toBe(0);
    expect(stats.unreadMessages).toBe(0);
  });

  it('allows admin to access the freelancer dashboard', async () => {
    authAdmin();
    queueFreelancerDashboardQueries();

    const res = await request(app)
      .get('/api/dashboard/freelancer')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dashboard');
  });

  it('returns 403 when a client accesses the freelancer dashboard', async () => {
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

  it('returns 401 for an invalid (malformed) token', async () => {
    const res = await request(app)
      .get('/api/dashboard/freelancer')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .get('/api/dashboard/freelancer')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists in DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/dashboard/freelancer')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeFreelancerRow, status: 'suspended' }] });

    const res = await request(app)
      .get('/api/dashboard/freelancer')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });

  it('returns 500 when one of the Promise.all queries throws', async () => {
    authFreelancer();
    // First DB query (earnings) rejects — this causes the whole Promise.all to reject
    mockQuery.mockRejectedValueOnce(new Error('Primary DB unavailable'));

    const res = await request(app)
      .get('/api/dashboard/freelancer')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });
});

// ── GET /api/dashboard/client ──────────────────────────────────────────────

describe('GET /api/dashboard/client', () => {
  it('returns 200 with full client dashboard structure', async () => {
    authClient();
    queueClientDashboardQueries();

    const res = await request(app)
      .get('/api/dashboard/client')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dashboard');

    const { stats, recentProjects, pendingApplications, activeContracts, monthlySpending } = res.body.dashboard;
    expect(stats).toHaveProperty('totalSpent');
    expect(stats).toHaveProperty('activeProjects');
    expect(stats).toHaveProperty('totalProjects');
    expect(stats).toHaveProperty('unreadMessages');
    expect(Array.isArray(recentProjects)).toBe(true);
    expect(Array.isArray(pendingApplications)).toBe(true);
    expect(Array.isArray(activeContracts)).toBe(true);
    expect(Array.isArray(monthlySpending)).toBe(true);
  });

  it('parses totalSpent as a float', async () => {
    authClient();
    queueClientDashboardQueries();

    const res = await request(app)
      .get('/api/dashboard/client')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.body.dashboard.stats.totalSpent).toBe(5000.00);
  });

  it('defaults stats to 0 when DB rows have null aggregates', async () => {
    authClient();
    for (let i = 0; i < 8; i++) {
      mockQuery.mockResolvedValueOnce({ rows: [{ total: null, count: null }] });
    }

    const res = await request(app)
      .get('/api/dashboard/client')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    const { stats } = res.body.dashboard;
    expect(stats.totalSpent).toBe(0);
    expect(stats.activeProjects).toBe(0);
    expect(stats.totalProjects).toBe(0);
    expect(stats.unreadMessages).toBe(0);
  });

  it('allows admin to access the client dashboard', async () => {
    authAdmin();
    queueClientDashboardQueries();

    const res = await request(app)
      .get('/api/dashboard/client')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dashboard');
  });

  it('returns 403 when a freelancer accesses the client dashboard', async () => {
    authFreelancer();

    const res = await request(app)
      .get('/api/dashboard/client')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Access denied');
  });

  it('returns 401 when no token', async () => {
    const res = await request(app).get('/api/dashboard/client');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid (malformed) token', async () => {
    const res = await request(app)
      .get('/api/dashboard/client')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .get('/api/dashboard/client')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists in DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/dashboard/client')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeClientRow, status: 'suspended' }] });

    const res = await request(app)
      .get('/api/dashboard/client')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });

  it('returns 500 when a Promise.all query throws', async () => {
    authClient();
    mockQuery.mockRejectedValueOnce(new Error('Replica not ready'));

    const res = await request(app)
      .get('/api/dashboard/client')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(500);
  });
});

// ── GET /api/dashboard/notifications ──────────────────────────────────────

describe('GET /api/dashboard/notifications', () => {
  it('returns 200 with notifications and unread count', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          { id: 'n1', type: 'welcome',     title: 'Welcome!',     is_read: false, created_at: new Date().toISOString() },
          { id: 'n2', type: 'new_message', title: 'New message!', is_read: true,  created_at: new Date().toISOString() }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/dashboard/notifications')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('notifications');
    expect(res.body.notifications).toHaveLength(2);
    expect(res.body).toHaveProperty('unreadCount', 1);
  });

  it('filters to only unread when unreadOnly=true', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'n3', is_read: false }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/dashboard/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
    // The query should contain the is_read = false filter
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('is_read = false'),
      expect.anything()
    );
  });

  it('does NOT apply is_read filter when unreadOnly is not "true"', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    await request(app)
      .get('/api/dashboard/notifications?unreadOnly=false')
      .set('Authorization', `Bearer ${freelancerToken}`);

    // The first call after auth should be the notifications query
    const notificationsCallArgs = mockQuery.mock.calls[1];
    // It should NOT include "is_read = false"
    expect(notificationsCallArgs[0]).not.toMatch(/is_read = false/);
  });

  it('respects pagination params (page and limit)', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const res = await request(app)
      .get('/api/dashboard/notifications?page=2&limit=5')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    // offset = (2-1)*5 = 5; query should contain LIMIT 5 OFFSET 5
    const notificationsCallArgs = mockQuery.mock.calls[1];
    expect(notificationsCallArgs[1]).toContain(5); // limit
    expect(notificationsCallArgs[1]).toContain(5); // offset
  });

  it('returns empty array and 0 unreadCount when no notifications', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const res = await request(app)
      .get('/api/dashboard/notifications')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(0);
    expect(res.body.unreadCount).toBe(0);
  });

  it('scopes notifications to the authenticated user only', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    await request(app)
      .get('/api/dashboard/notifications')
      .set('Authorization', `Bearer ${clientToken}`);

    // Both calls after auth must bind the current user's id
    const notifCall = mockQuery.mock.calls[1];
    expect(notifCall[1]).toContain('client-user-id');
  });

  it('returns 500 when the notifications query throws', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('Query plan error'));

    const res = await request(app)
      .get('/api/dashboard/notifications')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });

  it('returns 500 when the unread count query throws', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'n1' }] }) // notifications OK
      .mockRejectedValueOnce(new Error('Count query failed'));  // count fails

    const res = await request(app)
      .get('/api/dashboard/notifications')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });

  it('returns 401 when no token', async () => {
    const res = await request(app).get('/api/dashboard/notifications');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid (malformed) token', async () => {
    const res = await request(app)
      .get('/api/dashboard/notifications')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .get('/api/dashboard/notifications')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists in DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/dashboard/notifications')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeFreelancerRow, status: 'suspended' }] });

    const res = await request(app)
      .get('/api/dashboard/notifications')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
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

  it('scopes the UPDATE to the authenticated user (cannot mark another user\'s notification)', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await request(app)
      .patch('/api/dashboard/notifications/notification-id/read')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE notifications'),
      ['notification-id', 'freelancer-user-id']
    );
  });

  it('still returns 200 when the notification id does not exist (idempotent)', async () => {
    authFreelancer();
    // UPDATE affects 0 rows — the route does not check rowCount
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .patch('/api/dashboard/notifications/nonexistent-id/read')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
  });

  it('returns 500 when the UPDATE query throws', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('Write conflict'));

    const res = await request(app)
      .patch('/api/dashboard/notifications/notification-id/read')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });

  it('returns 401 when no token', async () => {
    const res = await request(app).patch('/api/dashboard/notifications/notification-id/read');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid (malformed) token', async () => {
    const res = await request(app)
      .patch('/api/dashboard/notifications/notification-id/read')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .patch('/api/dashboard/notifications/notification-id/read')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists in DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/dashboard/notifications/notification-id/read')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeFreelancerRow, status: 'suspended' }] });

    const res = await request(app)
      .patch('/api/dashboard/notifications/notification-id/read')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });
});

// ── POST /api/dashboard/notifications/read-all ────────────────────────────

describe('POST /api/dashboard/notifications/read-all', () => {
  it('returns 200 when all notifications are marked as read', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/dashboard/notifications/read-all')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'All notifications marked as read');
  });

  it('scopes the bulk UPDATE to the authenticated user', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await request(app)
      .post('/api/dashboard/notifications/read-all')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE notifications'),
      ['client-user-id']
    );
  });

  it('returns 200 even when there are no unread notifications (idempotent)', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .post('/api/dashboard/notifications/read-all')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'All notifications marked as read');
  });

  it('returns 500 when the UPDATE query throws', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('Deadlock detected'));

    const res = await request(app)
      .post('/api/dashboard/notifications/read-all')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });

  it('returns 401 when no token', async () => {
    const res = await request(app).post('/api/dashboard/notifications/read-all');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid (malformed) token', async () => {
    const res = await request(app)
      .post('/api/dashboard/notifications/read-all')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .post('/api/dashboard/notifications/read-all')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists in DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/dashboard/notifications/read-all')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeFreelancerRow, status: 'suspended' }] });

    const res = await request(app)
      .post('/api/dashboard/notifications/read-all')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });
});
