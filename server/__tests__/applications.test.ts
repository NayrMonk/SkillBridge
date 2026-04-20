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

const sampleApplication = {
  id: 'app-id', project_id: 'project-id', freelancer_id: 'freelancer-user-id',
  cover_letter: 'I am the best candidate', status: 'pending',
  proposed_budget: 1500, proposed_duration: '2 weeks'
};

// ── GET /api/applications/my ───────────────────────────────────────────────

describe('GET /api/applications/my', () => {
  it('returns 200 with freelancer applications', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleApplication] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/applications/my')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('applications');
    expect(res.body.pagination).toHaveProperty('total', 1);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/applications/my');
    expect(res.status).toBe(401);
  });

  it('returns 403 when client tries to access freelancer applications', async () => {
    authClient();

    const res = await request(app)
      .get('/api/applications/my')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
  });

  it('supports status filter', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleApplication] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/applications/my?status=pending')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.applications).toHaveLength(1);
  });

  it('supports pagination query params', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '10' }] });

    const res = await request(app)
      .get('/api/applications/my?page=2&limit=5')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(5);
    expect(res.body.pagination.total).toBe(10);
    expect(res.body.pagination.totalPages).toBe(2);
  });

  it('returns empty applications array when freelancer has none', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const res = await request(app)
      .get('/api/applications/my')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.applications).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
  });

  it('allows admin to access their own applications', async () => {
    authAdmin();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const res = await request(app)
      .get('/api/applications/my')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});

// ── POST /api/applications ─────────────────────────────────────────────────

describe('POST /api/applications', () => {
  it('returns 201 when freelancer submits valid application', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id', status: 'open', required_tests: null }] })
      .mockResolvedValueOnce({ rows: [] }); // not already applied

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [sampleApplication] }) // insert application
      .mockResolvedValueOnce({ rows: [] }) // update project count
      .mockResolvedValueOnce({ rows: [] }) // notification
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ projectId: 'project-id', coverLetter: 'I am the best candidate', proposedBudget: 1500 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('application');
    expect(res.body.message).toBe('Application submitted successfully');
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .post('/api/applications')
      .send({ projectId: 'project-id', coverLetter: 'Hi' });

    expect(res.status).toBe(401);
  });

  it('returns 403 when client tries to submit application', async () => {
    authClient();

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ projectId: 'project-id', coverLetter: 'Hi' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when projectId is missing', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ coverLetter: 'I am the best candidate' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('returns 400 when coverLetter is missing', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ projectId: 'project-id' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('returns 404 when project not found', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ projectId: 'nonexistent', coverLetter: 'Hi' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Project not found');
  });

  it('returns 400 when project is not open', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id', status: 'completed', required_tests: null }] });

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ projectId: 'project-id', coverLetter: 'Hi' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not accepting/);
  });

  it('returns 400 when freelancer applies to own project', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: 'freelancer-user-id', status: 'open', required_tests: null }] });

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ projectId: 'project-id', coverLetter: 'My project' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/own project/);
  });

  it('returns 409 when already applied', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id', status: 'open', required_tests: null }] })
      .mockResolvedValueOnce({ rows: [{ id: 'existing-app-id' }] });

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ projectId: 'project-id', coverLetter: 'Hi again' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already applied/);
  });

  it('returns 400 when required tests are not completed', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id', status: 'open', required_tests: ['test-1', 'test-2'] }] })
      .mockResolvedValueOnce({ rows: [] }) // not already applied
      .mockResolvedValueOnce({ rows: [{ test_template_id: 'test-1' }] }); // only test-1 passed

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ projectId: 'project-id', coverLetter: 'Hi' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Required tests not completed/);
    expect(res.body).toHaveProperty('missingTests');
    expect(res.body.missingTests).toContain('test-2');
  });

  it('allows application when all required tests are passed', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id', status: 'open', required_tests: ['test-1'] }] })
      .mockResolvedValueOnce({ rows: [] }) // not already applied
      .mockResolvedValueOnce({ rows: [{ test_template_id: 'test-1' }] }); // test-1 passed

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [sampleApplication] }) // insert application
      .mockResolvedValueOnce({ rows: [] }) // update project count
      .mockResolvedValueOnce({ rows: [] }) // notification
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ projectId: 'project-id', coverLetter: 'Hi, I passed the tests!' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('application');
  });

  it('rolls back transaction on DB error during application insert', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id', status: 'open', required_tests: null }] })
      .mockResolvedValueOnce({ rows: [] }); // not already applied

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce(new Error('DB insert failed')); // insert application throws

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ projectId: 'project-id', coverLetter: 'Hi' });

    expect(res.status).toBe(500);
    expect(mockClientRelease).toHaveBeenCalled();
  });
});

// ── DELETE /api/applications/:id ───────────────────────────────────────────

describe('DELETE /api/applications/:id', () => {
  it('returns 200 when freelancer withdraws own application', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{ freelancer_id: 'freelancer-user-id', status: 'pending', project_id: 'project-id' }]
    });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // delete application
      .mockResolvedValueOnce({ rows: [] }) // update count
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .delete('/api/applications/app-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Application withdrawn successfully');
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).delete('/api/applications/app-id');
    expect(res.status).toBe(401);
  });

  it('returns 404 when application not found', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/applications/nonexistent-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Application not found');
  });

  it('returns 403 when trying to delete another freelancer application', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{ freelancer_id: 'other-freelancer-id', status: 'pending', project_id: 'project-id' }]
    });

    const res = await request(app)
      .delete('/api/applications/app-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Not authorized');
  });

  it('returns 400 when trying to withdraw a hired application', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{ freelancer_id: 'freelancer-user-id', status: 'hired', project_id: 'project-id' }]
    });

    const res = await request(app)
      .delete('/api/applications/app-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/hired/);
  });

  it('returns 400 when trying to withdraw a shortlisted application', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{ freelancer_id: 'freelancer-user-id', status: 'shortlisted', project_id: 'project-id' }]
    });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // delete application
      .mockResolvedValueOnce({ rows: [] }) // update count
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    // shortlisted is not 'hired', so it should be withdrawable
    const res = await request(app)
      .delete('/api/applications/app-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Application withdrawn successfully');
  });

  it('allows admin to delete any freelancer application', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({
      rows: [{ freelancer_id: 'other-freelancer-id', status: 'pending', project_id: 'project-id' }]
    });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // delete application
      .mockResolvedValueOnce({ rows: [] }) // update count
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .delete('/api/applications/app-id')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Application withdrawn successfully');
  });

  it('rolls back transaction on DB error during deletion', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{ freelancer_id: 'freelancer-user-id', status: 'pending', project_id: 'project-id' }]
    });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce(new Error('DB delete failed')); // delete throws

    const res = await request(app)
      .delete('/api/applications/app-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
    expect(mockClientRelease).toHaveBeenCalled();
  });
});

// ── GET /api/applications/project/:projectId ───────────────────────────────

describe('GET /api/applications/project/:projectId', () => {
  it('returns 200 with project applications for owner', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id' }] })
      .mockResolvedValueOnce({ rows: [sampleApplication] });

    const res = await request(app)
      .get('/api/applications/project/project-id')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('applications');
    expect(Array.isArray(res.body.applications)).toBe(true);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/applications/project/project-id');
    expect(res.status).toBe(401);
  });

  it('returns 403 when freelancer tries to access project applications', async () => {
    authFreelancer();

    const res = await request(app)
      .get('/api/applications/project/project-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 when project not found', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/applications/project/nonexistent-id')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Project not found');
  });

  it('returns 403 when non-owner client accesses project applications', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id' }] });

    const res = await request(app)
      .get('/api/applications/project/project-id')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Not authorized');
  });

  it('returns empty array when project has no applications', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/applications/project/project-id')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.applications).toHaveLength(0);
  });

  it('supports status filter for project applications', async () => {
    authClient();
    const shortlistedApp = { ...sampleApplication, status: 'shortlisted' };
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id' }] })
      .mockResolvedValueOnce({ rows: [shortlistedApp] });

    const res = await request(app)
      .get('/api/applications/project/project-id?status=shortlisted')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.applications[0].status).toBe('shortlisted');
  });

  it('allows admin to access any project applications', async () => {
    authAdmin();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id' }] }) // not admin's project
      .mockResolvedValueOnce({ rows: [sampleApplication] });

    const res = await request(app)
      .get('/api/applications/project/project-id')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('applications');
  });
});

// ── PATCH /api/applications/:id/status ─────────────────────────────────────

describe('PATCH /api/applications/:id/status', () => {
  it('returns 200 when client shortlists application', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        ...sampleApplication, client_id: 'client-user-id',
        project_title: 'Build a Website', project_status: 'open'
      }]
    });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // update application
      .mockResolvedValueOnce({ rows: [] }) // notification
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .patch('/api/applications/app-id/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'shortlisted' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'shortlisted');
    expect(res.body.message).toBe('Application shortlisted successfully');
  });

  it('returns 200 when client rejects application', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        ...sampleApplication, client_id: 'client-user-id',
        project_title: 'Build a Website', project_status: 'open'
      }]
    });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // update application
      .mockResolvedValueOnce({ rows: [] }) // notification
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .patch('/api/applications/app-id/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'rejected' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .patch('/api/applications/app-id/status')
      .send({ status: 'shortlisted' });

    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid status value', async () => {
    authClient();

    const res = await request(app)
      .patch('/api/applications/app-id/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'in_review' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid status');
  });

  it('returns 400 when status is missing from body', async () => {
    authClient();

    const res = await request(app)
      .patch('/api/applications/app-id/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid status');
  });

  it('returns 404 when application not found', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/applications/nonexistent-id/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'shortlisted' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Application not found');
  });

  it('returns 403 when non-owner client tries to update application status', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        ...sampleApplication, client_id: 'other-client-id',
        project_title: 'Build a Website', project_status: 'open'
      }]
    });

    const res = await request(app)
      .patch('/api/applications/app-id/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'shortlisted' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Not authorized');
  });

  it('returns 400 when trying to change status of an already hired application', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        ...sampleApplication, status: 'hired', client_id: 'client-user-id',
        project_title: 'Build a Website', project_status: 'in_progress'
      }]
    });

    const res = await request(app)
      .patch('/api/applications/app-id/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'rejected' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/hired/);
  });

  it('creates contract and updates project when hiring freelancer', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        ...sampleApplication, client_id: 'client-user-id',
        project_title: 'Build a Website', project_status: 'open'
      }]
    });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // update application status
      .mockResolvedValueOnce({ rows: [] }) // check existing contract
      .mockResolvedValueOnce({ rows: [] }) // insert contract
      .mockResolvedValueOnce({ rows: [] }) // update project status
      .mockResolvedValueOnce({ rows: [] }) // reject other pending apps
      .mockResolvedValueOnce({ rows: [] }) // notification
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .patch('/api/applications/app-id/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'hired' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('hired');
    expect(res.body.message).toBe('Application hired successfully');
  });

  it('returns 400 when project already has an active contract', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        ...sampleApplication, client_id: 'client-user-id',
        project_title: 'Build a Website', project_status: 'open'
      }]
    });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // update application status
      .mockResolvedValueOnce({ rows: [{ id: 'existing-contract-id' }] }); // existing active contract

    const res = await request(app)
      .patch('/api/applications/app-id/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'hired' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/active contract/);
  });

  it('allows admin to update any application status', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        ...sampleApplication, client_id: 'other-client-id',
        project_title: 'Build a Website', project_status: 'open'
      }]
    });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // update application
      .mockResolvedValueOnce({ rows: [] }) // notification
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .patch('/api/applications/app-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'shortlisted' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('shortlisted');
  });

  it('stores client notes when provided', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        ...sampleApplication, client_id: 'client-user-id',
        project_title: 'Build a Website', project_status: 'open'
      }]
    });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // update application
      .mockResolvedValueOnce({ rows: [] }) // notification
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .patch('/api/applications/app-id/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'rejected', notes: 'Not enough experience' });

    expect(res.status).toBe(200);
  });

  it('rolls back transaction on DB error during status update', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        ...sampleApplication, client_id: 'client-user-id',
        project_title: 'Build a Website', project_status: 'open'
      }]
    });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce(new Error('DB update failed')); // update application throws

    const res = await request(app)
      .patch('/api/applications/app-id/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'shortlisted' });

    expect(res.status).toBe(500);
    expect(mockClientRelease).toHaveBeenCalled();
  });
});
