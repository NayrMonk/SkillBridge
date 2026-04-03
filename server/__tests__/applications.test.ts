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

  it('returns 403 when client tries to access freelancer applications', async () => {
    authClient();

    const res = await request(app)
      .get('/api/applications/my')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/applications/my');
    expect(res.status).toBe(401);
  });
});

// ── POST /api/applications ─────────────────────────────────────────────────

describe('POST /api/applications', () => {
  it('returns 201 when freelancer submits valid application', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id', status: 'open', required_tests: null }] }) // project
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
  });

  it('returns 400 when projectId or coverLetter missing', async () => {
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

  it('returns 403 when client tries to submit application', async () => {
    authClient();

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ projectId: 'project-id', coverLetter: 'Hi' });

    expect(res.status).toBe(403);
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
  });

  it('returns 400 when trying to withdraw hired application', async () => {
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
});

// ── GET /api/applications/project/:projectId ───────────────────────────────

describe('GET /api/applications/project/:projectId', () => {
  it('returns 200 with project applications for owner', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ client_id: 'client-user-id' }] }) // project ownership
      .mockResolvedValueOnce({ rows: [sampleApplication] }); // applications

    const res = await request(app)
      .get('/api/applications/project/project-id')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('applications');
    expect(Array.isArray(res.body.applications)).toBe(true);
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

  it('returns 403 when non-owner accesses project applications', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: 'other-client-id' }] });

    const res = await request(app)
      .get('/api/applications/project/project-id')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
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
  });

  it('returns 400 for invalid status', async () => {
    authClient();

    const res = await request(app)
      .patch('/api/applications/app-id/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'in_review' });

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

  it('returns 400 when trying to change hired application status', async () => {
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
});
