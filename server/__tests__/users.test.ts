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

// Auth middleware always needs one query to verify user
const authFreelancer = () => mockQuery.mockResolvedValueOnce({ rows: [activeFreelancerRow] });
const authClient = () => mockQuery.mockResolvedValueOnce({ rows: [activeClientRow] });

// ── GET /api/users/profile/:id ─────────────────────────────────────────────

describe('GET /api/users/profile/:id', () => {
  it('returns 200 with profile data', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'freelancer-user-id', email: 'freelancer@example.com',
        role: 'freelancer', display_name: 'Test Freelancer',
        skills: [], portfolio: [], reviews: []
      }]
    });

    const res = await request(app)
      .get('/api/users/profile/freelancer-user-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('profile');
  });

  it('returns 404 when user not found', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/users/profile/nonexistent-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/users/profile/some-id');
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/users/profile ─────────────────────────────────────────────────

describe('PUT /api/users/profile', () => {
  it('returns 200 when profile is updated', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{ user_id: 'freelancer-user-id', display_name: 'Updated Name', headline: 'Dev' }]
    });

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ displayName: 'Updated Name', headline: 'Dev' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Profile updated successfully');
  });

  it('returns 400 when no valid fields provided', async () => {
    authFreelancer();

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'No valid fields to update');
  });
});

// ── POST /api/users/skills ─────────────────────────────────────────────────

describe('POST /api/users/skills', () => {
  it('returns 200 when skill is added', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'skill-id' }] }) // skill exists
      .mockResolvedValueOnce({ rows: [] }); // upsert

    const res = await request(app)
      .post('/api/users/skills')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ skillId: 'skill-id', proficiencyLevel: 4 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Skill added successfully');
  });

  it('returns 400 when skillId is missing', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/users/skills')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Skill ID is required');
  });

  it('returns 404 when skill does not exist', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] }); // skill not found

    const res = await request(app)
      .post('/api/users/skills')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ skillId: 'nonexistent-skill' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Skill not found');
  });
});

// ── DELETE /api/users/skills/:skillId ─────────────────────────────────────

describe('DELETE /api/users/skills/:skillId', () => {
  it('returns 200 on successful skill removal', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/users/skills/skill-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Skill removed successfully');
  });
});

// ── POST /api/users/portfolio ──────────────────────────────────────────────

describe('POST /api/users/portfolio', () => {
  it('returns 201 with portfolio item on success', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'portfolio-id', title: 'My Project', user_id: 'freelancer-user-id' }]
    });

    const res = await request(app)
      .post('/api/users/portfolio')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ title: 'My Project', description: 'A cool project' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('item');
    expect(res.body.item.title).toBe('My Project');
  });

  it('returns 400 when title is missing', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/users/portfolio')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ description: 'No title here' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Title is required');
  });
});

// ── DELETE /api/users/portfolio/:id ───────────────────────────────────────

describe('DELETE /api/users/portfolio/:id', () => {
  it('returns 200 on successful deletion', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'portfolio-id' }] });

    const res = await request(app)
      .delete('/api/users/portfolio/portfolio-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Portfolio item deleted successfully');
  });

  it('returns 404 when item not found or not owned', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/users/portfolio/other-portfolio-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Portfolio item not found');
  });
});

// ── GET /api/users/search ──────────────────────────────────────────────────

describe('GET /api/users/search', () => {
  it('returns 200 with freelancers list', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'f1', display_name: 'Dev' }] });

    const res = await request(app)
      .get('/api/users/search')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('freelancers');
    expect(Array.isArray(res.body.freelancers)).toBe(true);
  });

  it('returns paginated results', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/users/search?page=2&limit=10')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(10);
  });
});

// ── GET /api/users/skills/list ─────────────────────────────────────────────

describe('GET /api/users/skills/list', () => {
  it('returns 200 with skills list', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 's1', name: 'JavaScript', category: 'Web Development' },
        { id: 's2', name: 'Python', category: 'AI/ML' }
      ]
    });

    const res = await request(app)
      .get('/api/users/skills/list')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('skills');
    expect(res.body.skills).toHaveLength(2);
  });

  it('filters skills by category', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 's1', name: 'JavaScript', category: 'Web Development' }]
    });

    const res = await request(app)
      .get('/api/users/skills/list?category=Web+Development')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.skills[0].category).toBe('Web Development');
  });
});
