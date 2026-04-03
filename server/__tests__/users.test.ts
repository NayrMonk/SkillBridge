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

// Helper function to make typed requests
function makeRequest(method: 'get' | 'post' | 'put' | 'delete' | 'patch', path: string) {
  const req = request(app);
  switch (method) {
    case 'get': return req.get(path);
    case 'post': return req.post(path);
    case 'put': return req.put(path);
    case 'delete': return req.delete(path);
    case 'patch': return req.patch(path);
  }
}

// Shared auth failure suite — call inside describe blocks that need full coverage
const sharedAuthTests = (method: 'get' | 'post' | 'put' | 'delete' | 'patch', path: string, body?: object) => {
  it('returns 401 when no token', async () => {
    const res = await makeRequest(method, path).send(body);
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid (malformed) token', async () => {
    const res = await makeRequest(method, path)
      .set('Authorization', `Bearer ${invalidToken}`)
      .send(body);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await makeRequest(method, path)
      .set('Authorization', `Bearer ${expiredToken}`)
      .send(body);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists in DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await makeRequest(method, path)
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send(body);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeFreelancerRow, status: 'suspended' }] });
    const res = await makeRequest(method, path)
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send(body);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });
};

// ── GET /api/users/profile/:id ─────────────────────────────────────────────

describe('GET /api/users/profile/:id', () => {
  it('returns 200 with full profile for own user id (email included)', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'freelancer-user-id', email: 'freelancer@example.com',
        role: 'freelancer', created_at: new Date().toISOString(),
        display_name: 'Test Freelancer', headline: 'Full-stack dev',
        skills: [{ id: 's1', name: 'React', category: 'Web', proficiency: 4 }],
        portfolio: [{ id: 'p1', title: 'Project Alpha' }],
        reviews: [{ id: 'r1', rating: 5, content: 'Great!' }]
      }]
    });

    const res = await request(app)
      .get('/api/users/profile/freelancer-user-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('profile');
    expect(res.body.profile.id).toBe('freelancer-user-id');
    // own profile — email must NOT be stripped
    expect(res.body.profile.email).toBe('freelancer@example.com');
    expect(res.body.profile.skills).toHaveLength(1);
    expect(res.body.profile.portfolio).toHaveLength(1);
    expect(res.body.profile.reviews).toHaveLength(1);
  });

  it('strips email when viewing another user\'s profile', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'client-user-id', email: 'client@example.com',
        role: 'client', display_name: 'Some Client',
        skills: [], portfolio: [], reviews: []
      }]
    });

    const res = await request(app)
      .get('/api/users/profile/client-user-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.profile).not.toHaveProperty('email');
  });

  it('returns 404 when user does not exist or is inactive', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/users/profile/nonexistent-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 500 when DB throws during profile fetch', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('Connection reset'));

    const res = await request(app)
      .get('/api/users/profile/freelancer-user-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });

  sharedAuthTests('get', '/api/users/profile/some-id');
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
    expect(res.body).toHaveProperty('profile');
  });

  it('creates a new profile when the UPDATE returns no rows', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // UPDATE found nothing
      .mockResolvedValueOnce({ rows: [{ user_id: 'freelancer-user-id', display_name: 'New User' }] }); // INSERT

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ displayName: 'New User' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('profile');
    expect(res.body.profile.display_name).toBe('New User');
  });

  it('creates profile with fallback display name "User" when displayName not sent', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // UPDATE found nothing
      .mockResolvedValueOnce({ rows: [{ user_id: 'freelancer-user-id', display_name: 'User' }] }); // INSERT

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ headline: 'A headline without a name' }); // displayName omitted

    expect(res.status).toBe(200);
    expect(res.body.profile.display_name).toBe('User');
  });

  it('returns 400 when the request body contains no valid updatable fields', async () => {
    authFreelancer();

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'No valid fields to update');
  });

  it('ignores unknown/extra fields and still updates valid ones', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{ user_id: 'freelancer-user-id', display_name: 'Hacker Name' }]
    });

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ displayName: 'Hacker Name', role: 'admin', status: 'active', password: 'p@ss' });

    // The route should only update allowed fields and succeed
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Profile updated successfully');
  });

  it('returns 500 when the UPDATE query throws', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('DB crash'));

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ displayName: 'Will Fail' });

    expect(res.status).toBe(500);
  });

  sharedAuthTests('put', '/api/users/profile', { displayName: 'Test' });
});

// ── POST /api/users/skills ─────────────────────────────────────────────────

describe('POST /api/users/skills', () => {
  it('returns 200 when skill is added with explicit proficiency level', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'skill-id' }] }) // skill exists
      .mockResolvedValueOnce({ rows: [] });                   // upsert

    const res = await request(app)
      .post('/api/users/skills')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ skillId: 'skill-id', proficiencyLevel: 4 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Skill added successfully');
    // upsert query should have been called with proficiency 4
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_skills'),
      ['freelancer-user-id', 'skill-id', 4]
    );
  });

  it('defaults proficiency to 3 when proficiencyLevel is omitted', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'skill-id' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/users/skills')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ skillId: 'skill-id' });

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_skills'),
      ['freelancer-user-id', 'skill-id', 3]
    );
  });

  it('returns 400 when skillId is missing', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/users/skills')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ proficiencyLevel: 3 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Skill ID is required');
  });

  it('returns 400 when body is completely empty', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/users/skills')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Skill ID is required');
  });

  it('returns 404 when the skill does not exist in the skills table', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] }); // skill lookup returns nothing

    const res = await request(app)
      .post('/api/users/skills')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ skillId: 'nonexistent-skill' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Skill not found');
  });

  it('returns 500 when skill lookup query throws', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post('/api/users/skills')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ skillId: 'skill-id' });

    expect(res.status).toBe(500);
  });

  it('returns 500 when upsert query throws', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'skill-id' }] })
      .mockRejectedValueOnce(new Error('Upsert failed'));

    const res = await request(app)
      .post('/api/users/skills')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ skillId: 'skill-id' });

    expect(res.status).toBe(500);
  });

  sharedAuthTests('post', '/api/users/skills', { skillId: 'skill-id' });
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

  it('only deletes the skill belonging to the authenticated user', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await request(app)
      .delete('/api/users/skills/skill-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM user_skills'),
      ['freelancer-user-id', 'skill-id']
    );
  });

  it('returns 200 even when the skill was not associated with the user (idempotent DELETE)', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no rows deleted

    const res = await request(app)
      .delete('/api/users/skills/unowned-skill')
      .set('Authorization', `Bearer ${freelancerToken}`);

    // The route does not check rowCount — it always returns 200
    expect(res.status).toBe(200);
  });

  it('returns 500 when DB throws during delete', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('Lock timeout'));

    const res = await request(app)
      .delete('/api/users/skills/skill-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });

  sharedAuthTests('delete', '/api/users/skills/skill-id');
});

// ── POST /api/users/portfolio ──────────────────────────────────────────────

describe('POST /api/users/portfolio', () => {
  it('returns 201 with portfolio item on success', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'portfolio-id', title: 'My Project', user_id: 'freelancer-user-id', image_urls: [], skills: [] }]
    });

    const res = await request(app)
      .post('/api/users/portfolio')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ title: 'My Project', description: 'A cool project', projectUrl: 'https://example.com' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message', 'Portfolio item added successfully');
    expect(res.body).toHaveProperty('item');
    expect(res.body.item.title).toBe('My Project');
  });

  it('defaults imageUrls to [] and skills to [] when not provided', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'portfolio-id', title: 'Simple', image_urls: [], skills: [] }]
    });

    await request(app)
      .post('/api/users/portfolio')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ title: 'Simple' });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO portfolio_items'),
      ['freelancer-user-id', 'Simple', undefined, [], undefined, []]
    );
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

  it('returns 400 when body is empty', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/users/portfolio')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Title is required');
  });

  it('returns 500 when INSERT throws', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('Disk full'));

    const res = await request(app)
      .post('/api/users/portfolio')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ title: 'Broken Portfolio' });

    expect(res.status).toBe(500);
  });

  sharedAuthTests('post', '/api/users/portfolio', { title: 'Test' });
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

  it('scopes the DELETE to the authenticated user to prevent unauthorized removal', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'portfolio-id' }] });

    await request(app)
      .delete('/api/users/portfolio/portfolio-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM portfolio_items'),
      ['portfolio-id', 'freelancer-user-id']
    );
  });

  it('returns 404 when item does not exist', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/users/portfolio/nonexistent-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Portfolio item not found');
  });

  it('returns 404 when item exists but belongs to another user', async () => {
    authFreelancer();
    // DELETE … WHERE id = ? AND user_id = ? — returns nothing if user_id doesn't match
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/users/portfolio/other-users-portfolio')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Portfolio item not found');
  });

  it('returns 500 when DELETE query throws', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('Query timeout'));

    const res = await request(app)
      .delete('/api/users/portfolio/portfolio-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });

  sharedAuthTests('delete', '/api/users/portfolio/portfolio-id');
});

// ── GET /api/users/search ──────────────────────────────────────────────────

describe('GET /api/users/search', () => {
  it('returns 200 with freelancers list (no filters)', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'f1', display_name: 'Alice', hourly_rate: '50', rating: '4.8', skills: [] },
        { id: 'f2', display_name: 'Bob',   hourly_rate: '40', rating: '4.5', skills: [] }
      ]
    });

    const res = await request(app)
      .get('/api/users/search')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('freelancers');
    expect(Array.isArray(res.body.freelancers)).toBe(true);
    expect(res.body.freelancers).toHaveLength(2);
  });

  it('returns pagination metadata with defaults (page 1, limit 20)', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/users/search')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20 });
  });

  it('respects custom page and limit query params', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/users/search?page=3&limit=5')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 3, limit: 5 });
  });

  it('applies minRating filter', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'f1', rating: '5' }] });

    const res = await request(app)
      .get('/api/users/search?minRating=4.5')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    // Verify the query includes the rating filter
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('p.rating >='),
      expect.arrayContaining(['4.5'])
    );
  });

  it('applies maxHourlyRate filter', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'f2', hourly_rate: '30' }] });

    const res = await request(app)
      .get('/api/users/search?maxHourlyRate=50')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('p.hourly_rate'),
      expect.arrayContaining(['50'])
    );
  });

  it('applies availability filter', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/users/search?availability=full_time')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('p.availability'),
      expect.arrayContaining(['full_time'])
    );
  });

  it('applies freetext search filter', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'f3', display_name: 'React Dev' }] });

    const res = await request(app)
      .get('/api/users/search?search=React')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      expect.arrayContaining(['%React%'])
    );
  });

  it('applies skills filter as an array', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'f4', display_name: 'TypeScript Dev' }] });

    const res = await request(app)
      .get('/api/users/search?skills=skill-1')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ANY'),
      expect.anything()
    );
  });

  it('returns empty array when no freelancers match filters', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/users/search?search=doesnotexist')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.freelancers).toHaveLength(0);
  });

  it('returns 500 when DB throws during search', async () => {
    authClient();
    mockQuery.mockRejectedValueOnce(new Error('Replica lag'));

    const res = await request(app)
      .get('/api/users/search')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(500);
  });

  sharedAuthTests('get', '/api/users/search');
});

// ── GET /api/users/skills/list ─────────────────────────────────────────────

describe('GET /api/users/skills/list', () => {
  it('returns 200 with all skills when no category filter', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 's1', name: 'JavaScript', category: 'Web Development' },
        { id: 's2', name: 'Python',     category: 'AI/ML' }
      ]
    });

    const res = await request(app)
      .get('/api/users/skills/list')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('skills');
    expect(res.body.skills).toHaveLength(2);
  });

  it('filters skills by category when ?category is provided', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 's1', name: 'JavaScript', category: 'Web Development' }]
    });

    const res = await request(app)
      .get('/api/users/skills/list?category=Web+Development')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.skills).toHaveLength(1);
    expect(res.body.skills[0].category).toBe('Web Development');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE category'),
      ['Web Development']
    );
  });

  it('returns empty array when no skills match the category', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/users/skills/list?category=Nonexistent')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.skills).toHaveLength(0);
  });

  it('returns 500 when DB throws during skills list fetch', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('Query error'));

    const res = await request(app)
      .get('/api/users/skills/list')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });

  it('is accessible by clients too', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's1', name: 'React', category: 'Web Development' }] });

    const res = await request(app)
      .get('/api/users/skills/list')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.skills).toHaveLength(1);
  });

  it('is accessible by admins', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's1', name: 'React', category: 'Web Development' }] });

    const res = await request(app)
      .get('/api/users/skills/list')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  sharedAuthTests('get', '/api/users/skills/list');
});
