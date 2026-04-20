/// <reference types="jest" />
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
  jest.clearAllMocks();
  mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
});

const authFreelancer = () => mockQuery.mockResolvedValueOnce({ rows: [activeFreelancerRow] });
const authClient = () => mockQuery.mockResolvedValueOnce({ rows: [activeClientRow] });
const authAdmin = () => mockQuery.mockResolvedValueOnce({ rows: [activeAdminRow] });

const sampleProject = {
  id: 'project-id', title: 'Build a Website', description: 'Full stack project',
  category: 'Web Development', client_id: 'client-user-id', status: 'open',
  budget_min: 500, budget_max: 2000, budget_type: 'fixed',
  skills_required: null
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

  it('supports pagination query params', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '50' }] });

    const res = await request(app)
      .get('/api/projects?page=2&limit=10')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(10);
    expect(res.body.pagination.totalPages).toBe(5);
  });

  it('filters by category', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleProject] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/projects?category=Web%20Development')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
  });

  it('filters by budget_min and budget_max', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleProject] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/projects?budget_min=500&budget_max=3000')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('projects');
  });

  it('filters by search keyword', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleProject] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/projects?search=website')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
  });

  it('filters by skills array', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleProject] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/projects?skills=skill-1&skills=skill-2')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('projects');
  });

  it('filters by experience_level', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleProject] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/projects?experience_level=intermediate')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('projects');
  });

  it('sorts by allowed column', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleProject] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/projects?sort_by=budget_max&sort_order=asc')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('projects');
  });

  it('ignores invalid sort_by and defaults to created_at', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleProject] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/projects?sort_by=invalid_column')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('projects');
  });

  it('returns empty list when no projects match filters', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const res = await request(app)
      .get('/api/projects?category=Nonexistent')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
    expect(res.body.pagination.totalPages).toBe(0);
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

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/projects/featured');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no featured projects exist', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/projects/featured')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(0);
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
    expect(res.body.projects[0].promotion_tier).toBe('hot');
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/projects/hot');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no hot projects exist', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/projects/hot')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(0);
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

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/projects/categories/list');
    expect(res.status).toBe(401);
  });

  it('returns empty categories when no open projects exist', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/projects/categories/list')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(0);
  });
});

// ── GET /api/projects/:id ──────────────────────────────────────────────────

describe('GET /api/projects/:id', () => {
  it('returns 200 with project details including skills and milestones', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // increment views
      .mockResolvedValueOnce({ rows: [{ ...sampleProject, skills_required: ['skill-1'] }] })
      .mockResolvedValueOnce({ rows: [{ id: 'skill-1', name: 'JS', category: 'Web' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'mile-1', title: 'Phase 1' }] })
      .mockResolvedValueOnce({ rows: [] }) // required tests
      .mockResolvedValueOnce({ rows: [] }); // user application

    const res = await request(app)
      .get('/api/projects/project-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('project');
    expect(res.body.project.title).toBe('Build a Website');
    expect(res.body.project.skills).toHaveLength(1);
    expect(res.body.project.milestones).toHaveLength(1);
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

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/projects/project-id');
    expect(res.status).toBe(401);
  });

  it('skips skills query when project has no skills_required', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // increment views
      .mockResolvedValueOnce({ rows: [{ ...sampleProject, skills_required: null }] })
      .mockResolvedValueOnce({ rows: [] }) // milestones
      .mockResolvedValueOnce({ rows: [] }) // required tests
      .mockResolvedValueOnce({ rows: [] }); // user application

    const res = await request(app)
      .get('/api/projects/project-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.project).not.toHaveProperty('skills');
  });

  it('does not attach userApplication for client role', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // increment views
      .mockResolvedValueOnce({ rows: [{ ...sampleProject, skills_required: null }] })
      .mockResolvedValueOnce({ rows: [] }) // milestones
      .mockResolvedValueOnce({ rows: [] }); // required tests (no userApplication query for client)

    const res = await request(app)
      .get('/api/projects/project-id')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.project).not.toHaveProperty('userApplication');
  });

  it('attaches userApplication for freelancer who already applied', async () => {
    authFreelancer();
    const existingApp = { id: 'app-id', status: 'pending' };
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // increment views
      .mockResolvedValueOnce({ rows: [{ ...sampleProject, skills_required: null }] })
      .mockResolvedValueOnce({ rows: [] }) // milestones
      .mockResolvedValueOnce({ rows: [] }) // required tests
      .mockResolvedValueOnce({ rows: [existingApp] }); // user application

    const res = await request(app)
      .get('/api/projects/project-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.project.userApplication).toEqual(existingApp);
  });

  it('returns project with required tests', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // increment views
      .mockResolvedValueOnce({ rows: [{ ...sampleProject, skills_required: null }] })
      .mockResolvedValueOnce({ rows: [] }) // milestones
      .mockResolvedValueOnce({ rows: [{ id: 'test-1', title: 'JS Test' }] }) // required tests
      .mockResolvedValueOnce({ rows: [] }); // user application

    const res = await request(app)
      .get('/api/projects/project-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.project.requiredTests).toHaveLength(1);
    expect(res.body.project.requiredTests[0].title).toBe('JS Test');
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
    expect(res.body.message).toBe('Project created successfully');
  });

  it('returns 403 when freelancer tries to create project', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ title: 'Build a Website', description: 'Full stack', category: 'Web Development' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when title is missing', async () => {
    authClient();

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ description: 'Full stack', category: 'Web Development' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('returns 400 when description is missing', async () => {
    authClient();

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'Build a Website', category: 'Web Development' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('returns 400 when category is missing', async () => {
    authClient();

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'Build a Website', description: 'Full stack' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ title: 'Build a Website', description: 'Full stack', category: 'Web Development' });

    expect(res.status).toBe(401);
  });

  it('creates project with milestones', async () => {
    authClient();
    const projectWithId = { ...sampleProject, id: 'new-project-id' };
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [projectWithId] }) // insert project
      .mockResolvedValueOnce({ rows: [] }) // insert milestone 1
      .mockResolvedValueOnce({ rows: [] }) // insert milestone 2
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Build a Website',
        description: 'Full stack',
        category: 'Web Development',
        milestones: [
          { title: 'Phase 1', description: 'Setup', amount: 500, dueDate: '2026-05-01' },
          { title: 'Phase 2', description: 'Build', amount: 1500, dueDate: '2026-06-01' }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('project');
  });

  it('creates project with requiredTests', async () => {
    authClient();
    const projectWithId = { ...sampleProject, id: 'new-project-id' };
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [projectWithId] }) // insert project
      .mockResolvedValueOnce({ rows: [] }) // link test
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Build a Website',
        description: 'Full stack',
        category: 'Web Development',
        requiredTests: ['test-template-id-1']
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('project');
  });

  it('rolls back transaction on DB error during project creation', async () => {
    authClient();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce(new Error('DB insert failed')); // insert project throws

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'Build a Website', description: 'Full stack', category: 'Web Development' });

    expect(res.status).toBe(500);
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('allows admin to create a project', async () => {
    authAdmin();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [sampleProject] }) // insert project
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Build a Website', description: 'Full stack', category: 'Web Development' });

    expect(res.status).toBe(201);
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
    expect(res.body.project.title).toBe('Updated Title');
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
    expect(res.body.error).toMatch(/Not authorized/);
  });

  it('returns 400 for completed projects', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id', status: 'completed' }] });

    const res = await request(app)
      .put('/api/projects/project-id')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'New Title' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot update/);
  });

  it('returns 400 for cancelled projects', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id', status: 'cancelled' }] });

    const res = await request(app)
      .put('/api/projects/project-id')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'New Title' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot update/);
  });

  it('returns 400 when no valid fields are provided', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id', status: 'open' }] });

    const res = await request(app)
      .put('/api/projects/project-id')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ nonExistentField: 'value' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No valid fields/);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .put('/api/projects/project-id')
      .send({ title: 'New Title' });

    expect(res.status).toBe(401);
  });

  it('allows admin to update any project', async () => {
    authAdmin();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id', status: 'open' }] })
      .mockResolvedValueOnce({ rows: [{ ...sampleProject, title: 'Admin Updated' }] });

    const res = await request(app)
      .put('/api/projects/project-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Admin Updated' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Project updated successfully');
  });

  it('allows updating in_progress projects', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id', status: 'in_progress' }] })
      .mockResolvedValueOnce({ rows: [{ ...sampleProject, description: 'Updated desc' }] });

    const res = await request(app)
      .put('/api/projects/project-id')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ description: 'Updated desc' });

    expect(res.status).toBe(200);
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
    expect(res.body).toHaveProperty('error', 'Project not found');
  });

  it('returns 403 when non-owner tries to delete', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id', status: 'open' }] });

    const res = await request(app)
      .delete('/api/projects/project-id')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Not authorized');
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).delete('/api/projects/project-id');
    expect(res.status).toBe(401);
  });

  it('allows admin to cancel any project', async () => {
    authAdmin();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id', status: 'open' }] })
      .mockResolvedValueOnce({ rows: [] }) // soft delete
      .mockResolvedValueOnce({ rows: [] }); // reject applications

    const res = await request(app)
      .delete('/api/projects/project-id')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Project cancelled successfully');
  });

  it('cancels an in_progress project', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id', status: 'in_progress' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/projects/project-id')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Project cancelled successfully');
  });
});

// ── POST /api/projects/:id/promote ─────────────────────────────────────────

describe('POST /api/projects/:id/promote', () => {
  it('returns 200 on successful promotion to hot with sufficient balance', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id', promotion_tier: null }] })
      .mockResolvedValueOnce({ rows: [{ value: '49.99' }] })
      .mockResolvedValueOnce({ rows: [{ balance: 100 }] });

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

  it('returns 200 on successful promotion to super_hot', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id', promotion_tier: null }] })
      .mockResolvedValueOnce({ rows: [{ value: '99.99' }] })
      .mockResolvedValueOnce({ rows: [{ balance: 200 }] });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // deduct wallet
      .mockResolvedValueOnce({ rows: [] }) // create transaction
      .mockResolvedValueOnce({ rows: [] }) // update project
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/projects/project-id/promote')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ tier: 'super_hot' });

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('super_hot');
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

  it('returns 400 when tier is missing', async () => {
    authClient();

    const res = await request(app)
      .post('/api/projects/project-id/promote')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid promotion tier/);
  });

  it('returns 404 when project not found', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [] }); // project not found

    const res = await request(app)
      .post('/api/projects/project-id/promote')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ tier: 'hot' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Project not found');
  });

  it('returns 403 when non-owner tries to promote', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id', promotion_tier: null }] });

    const res = await request(app)
      .post('/api/projects/project-id/promote')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ tier: 'hot' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Not authorized');
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
    expect(res.body).toHaveProperty('required');
    expect(res.body).toHaveProperty('current');
  });

  it('returns 400 when no wallet exists', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id', promotion_tier: null }] })
      .mockResolvedValueOnce({ rows: [{ value: '49.99' }] })
      .mockResolvedValueOnce({ rows: [] }); // no wallet

    const res = await request(app)
      .post('/api/projects/project-id/promote')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ tier: 'hot' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Insufficient balance/);
    expect(res.body.current).toBe(0);
  });

  it('uses default price when platform_settings has no entry', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id', promotion_tier: null }] })
      .mockResolvedValueOnce({ rows: [] }) // no settings row — defaults to 49.99
      .mockResolvedValueOnce({ rows: [{ balance: 100 }] });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // deduct wallet
      .mockResolvedValueOnce({ rows: [] }) // create transaction
      .mockResolvedValueOnce({ rows: [] }) // update project
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/projects/project-id/promote')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ tier: 'hot' });

    expect(res.status).toBe(200);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .post('/api/projects/project-id/promote')
      .send({ tier: 'hot' });

    expect(res.status).toBe(401);
  });

  it('rolls back transaction on DB error during promotion', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id', promotion_tier: null }] })
      .mockResolvedValueOnce({ rows: [{ value: '49.99' }] })
      .mockResolvedValueOnce({ rows: [{ balance: 100 }] });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce(new Error('DB error during deduction')); // deduct wallet throws

    const res = await request(app)
      .post('/api/projects/project-id/promote')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ tier: 'hot' });

    expect(res.status).toBe(500);
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('allows admin to promote any project', async () => {
    authAdmin();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id', promotion_tier: null }] })
      .mockResolvedValueOnce({ rows: [{ value: '49.99' }] })
      .mockResolvedValueOnce({ rows: [{ balance: 200 }] });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // deduct wallet
      .mockResolvedValueOnce({ rows: [] }) // create transaction
      .mockResolvedValueOnce({ rows: [] }) // update project
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/projects/project-id/promote')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tier: 'hot' });

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('hot');
  });
});
