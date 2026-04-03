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
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();

beforeEach(() => {
  mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
});

const authFreelancer = () => mockQuery.mockResolvedValueOnce({ rows: [activeFreelancerRow] });
const authClient = () => mockQuery.mockResolvedValueOnce({ rows: [activeClientRow] });
const authAdmin = () => mockQuery.mockResolvedValueOnce({ rows: [activeAdminRow] });

const sampleProject = {
  id: 'project-id', title: 'Build a Website', description: 'Full stack project',
  category: 'Web Development', client_id: 'client-user-id', status: 'open',
  budget_min: 500, budget_max: 2000, budget_type: 'fixed'
};

// ── GET /api/projects ──────────────────────────────────────────────────────

describe('GET /api/projects', () => {
  it('returns 200 with projects list', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleProject] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('projects');
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination).toHaveProperty('total', 1);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  it('supports pagination', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '50' }] });

    const res = await request(app)
      .get('/api/projects?page=2&limit=10')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.totalPages).toBe(5);
  });
});

// ── GET /api/projects/featured ─────────────────────────────────────────────

describe('GET /api/projects/featured', () => {
  it('returns 200 with featured projects', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [sampleProject] });

    const res = await request(app)
      .get('/api/projects/featured')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('projects');
    expect(Array.isArray(res.body.projects)).toBe(true);
  });
});

// ── GET /api/projects/hot ──────────────────────────────────────────────────

describe('GET /api/projects/hot', () => {
  it('returns 200 with hot projects', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ ...sampleProject, promotion_tier: 'hot' }] });

    const res = await request(app)
      .get('/api/projects/hot')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('projects');
  });
});

// ── GET /api/projects/categories/list ─────────────────────────────────────

describe('GET /api/projects/categories/list', () => {
  it('returns 200 with categories list', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [
        { category: 'Web Development', project_count: '10' },
        { category: 'Design', project_count: '5' }
      ]
    });

    const res = await request(app)
      .get('/api/projects/categories/list')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('categories');
    expect(res.body.categories).toHaveLength(2);
  });
});

// ── GET /api/projects/:id ──────────────────────────────────────────────────

describe('GET /api/projects/:id', () => {
  it('returns 200 with project details', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // increment views
      .mockResolvedValueOnce({ rows: [{ ...sampleProject, skills_required: ['skill-1'] }] }) // get project
      .mockResolvedValueOnce({ rows: [{ id: 'skill-1', name: 'JS', category: 'Web' }] }) // skills
      .mockResolvedValueOnce({ rows: [] }) // milestones
      .mockResolvedValueOnce({ rows: [] }) // required tests
      .mockResolvedValueOnce({ rows: [] }); // user application

    const res = await request(app)
      .get('/api/projects/project-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('project');
    expect(res.body.project.title).toBe('Build a Website');
  });

  it('returns 404 when project not found', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // increment views
      .mockResolvedValueOnce({ rows: [] }); // project not found

    const res = await request(app)
      .get('/api/projects/nonexistent-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Project not found');
  });
});

// ── POST /api/projects ─────────────────────────────────────────────────────

describe('POST /api/projects', () => {
  it('returns 201 when client creates a project', async () => {
    authClient();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [sampleProject] }) // insert project
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'Build a Website', description: 'Full stack', category: 'Web Development' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('project');
  });

  it('returns 403 when freelancer tries to create project', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ title: 'Build a Website', description: 'Full stack', category: 'Web Development' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when required fields are missing', async () => {
    authClient();

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'Missing fields' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });
});

// ── PUT /api/projects/:id ──────────────────────────────────────────────────

describe('PUT /api/projects/:id', () => {
  it('returns 200 when owner updates project', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id', status: 'open' }] }) // ownership check
      .mockResolvedValueOnce({ rows: [{ ...sampleProject, title: 'Updated Title' }] }); // update result

    const res = await request(app)
      .put('/api/projects/project-id')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Project updated successfully');
  });

  it('returns 404 when project not found', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/projects/nonexistent-id')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Project not found');
  });

  it('returns 403 when non-owner tries to update', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id', status: 'open' }] });

    const res = await request(app)
      .put('/api/projects/project-id')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'New Title' });

    expect(res.status).toBe(403);
  });

  it('returns 400 for completed or cancelled projects', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id', status: 'completed' }] });

    const res = await request(app)
      .put('/api/projects/project-id')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'New Title' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot update/);
  });
});

// ── DELETE /api/projects/:id ───────────────────────────────────────────────

describe('DELETE /api/projects/:id', () => {
  it('returns 200 when owner cancels project', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id', status: 'open' }] })
      .mockResolvedValueOnce({ rows: [] }) // soft delete
      .mockResolvedValueOnce({ rows: [] }); // reject applications

    const res = await request(app)
      .delete('/api/projects/project-id')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Project cancelled successfully');
  });

  it('returns 404 when project not found', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/projects/nonexistent-id')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 when non-owner tries to delete', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id', status: 'open' }] });

    const res = await request(app)
      .delete('/api/projects/project-id')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
  });
});

// ── POST /api/projects/:id/promote ─────────────────────────────────────────

describe('POST /api/projects/:id/promote', () => {
  it('returns 200 on successful promotion with sufficient balance', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id', promotion_tier: null }] }) // project
      .mockResolvedValueOnce({ rows: [{ value: '49.99' }] }) // settings price
      .mockResolvedValueOnce({ rows: [{ balance: 100 }] }); // wallet balance

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // deduct wallet
      .mockResolvedValueOnce({ rows: [] }) // create transaction
      .mockResolvedValueOnce({ rows: [] }) // update project promotion
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/projects/project-id/promote')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ tier: 'hot' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Project promoted successfully');
    expect(res.body.tier).toBe('hot');
  });

  it('returns 400 for invalid tier', async () => {
    authClient();

    const res = await request(app)
      .post('/api/projects/project-id/promote')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ tier: 'premium' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid promotion tier/);
  });

  it('returns 400 when balance is insufficient', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id', promotion_tier: null }] })
      .mockResolvedValueOnce({ rows: [{ value: '99.99' }] })
      .mockResolvedValueOnce({ rows: [{ balance: 10 }] });

    const res = await request(app)
      .post('/api/projects/project-id/promote')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ tier: 'super_hot' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Insufficient balance/);
  });
});
