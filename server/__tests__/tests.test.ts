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

const sampleTemplate = {
  id: 'template-id', title: 'JS Test', category: 'Web Development',
  duration_minutes: 60, passing_score: 70, is_ai_generated: false,
  client_id: 'client-user-id'
};

const sampleAttempt = {
  id: 'attempt-id', test_template_id: 'template-id', user_id: 'freelancer-user-id',
  status: 'in_progress', max_score: 30, score: null, passed: null
};

// ── GET /api/tests/templates ───────────────────────────────────────────────

describe('GET /api/tests/templates', () => {
  it('returns 200 with templates list', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ ...sampleTemplate, question_count: '5' }] });

    const res = await request(app)
      .get('/api/tests/templates')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('templates');
    expect(Array.isArray(res.body.templates)).toBe(true);
  });

  it('filters templates by category', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ ...sampleTemplate, question_count: '3' }] });

    const res = await request(app)
      .get('/api/tests/templates?category=Web+Development')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(1);
  });

  it('returns 401 when no token', async () => {
    const res = await request(app).get('/api/tests/templates');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/tests/templates/:id ──────────────────────────────────────────

describe('GET /api/tests/templates/:id', () => {
  it('returns 200 with template and questions', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleTemplate] }) // template
      .mockResolvedValueOnce({ rows: [{ id: 'q1', question_type: 'mcq', question_text: 'What is JS?', points: 10 }] }); // questions

    const res = await request(app)
      .get('/api/tests/templates/template-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('template');
    expect(res.body.template).toHaveProperty('questions');
    expect(Array.isArray(res.body.template.questions)).toBe(true);
  });

  it('returns 404 when template not found', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/tests/templates/nonexistent')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Test template not found');
  });
});

// ── POST /api/tests/templates ──────────────────────────────────────────────

describe('POST /api/tests/templates', () => {
  it('returns 201 when client creates test template', async () => {
    authClient();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [sampleTemplate] }) // insert template
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'JS Test', category: 'Web Development',
        durationMinutes: 60, passingScore: 70
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('template');
  });

  it('returns 400 when required fields missing', async () => {
    authClient();

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'JS Test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('returns 403 when freelancer tries to create template', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ title: 'Test', category: 'Web Dev', durationMinutes: 30, passingScore: 70 });

    expect(res.status).toBe(403);
  });
});

// ── POST /api/tests/attempts ───────────────────────────────────────────────

describe('POST /api/tests/attempts', () => {
  it('returns 201 when freelancer starts a test', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleTemplate] }) // template exists
      .mockResolvedValueOnce({ rows: [] }) // not previously completed
      .mockResolvedValueOnce({ rows: [{ id: 'q1', points: 10 }, { id: 'q2', points: 20 }] }) // questions
      .mockResolvedValueOnce({ rows: [sampleAttempt] }); // create attempt

    const res = await request(app)
      .post('/api/tests/attempts')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ testTemplateId: 'template-id' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('attempt');
    expect(res.body).toHaveProperty('questions');
    expect(res.body).toHaveProperty('template');
  });

  it('returns 400 when testTemplateId is missing', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/tests/attempts')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('returns 404 when template not found', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/tests/attempts')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ testTemplateId: 'nonexistent' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Test template not found');
  });

  it('returns 400 when test already completed', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleTemplate] })
      .mockResolvedValueOnce({ rows: [{ ...sampleAttempt, status: 'completed', passed: true }] });

    const res = await request(app)
      .post('/api/tests/attempts')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ testTemplateId: 'template-id' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already completed/);
  });

  it('returns 403 when client tries to start a test', async () => {
    authClient();

    const res = await request(app)
      .post('/api/tests/attempts')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ testTemplateId: 'template-id' });

    expect(res.status).toBe(403);
  });
});

// ── POST /api/tests/attempts/:id/submit ───────────────────────────────────

describe('POST /api/tests/attempts/:id/submit', () => {
  it('returns 200 with test result on submission', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ ...sampleAttempt, passing_score: 70, max_score: 30 }]
      }) // attempt
      .mockResolvedValueOnce({
        rows: [{
          id: 'q1', question_type: 'mcq', question_text: 'Q1?',
          correct_answer: 'A', points: 10, order_index: 0
        }]
      }) // questions
      .mockResolvedValueOnce({ rows: [] }); // update attempt

    const res = await request(app)
      .post('/api/tests/attempts/attempt-id/submit')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ answers: [{ questionId: 'q1', answer: 'A' }] });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('result');
    expect(res.body.result).toHaveProperty('score');
    expect(res.body.result).toHaveProperty('passed');
  });

  it('returns 404 when attempt not found', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/tests/attempts/nonexistent/submit')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ answers: [] });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Test attempt not found');
  });

  it('returns 400 when attempt is already completed', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...sampleAttempt, status: 'completed', passing_score: 70 }]
    });

    const res = await request(app)
      .post('/api/tests/attempts/attempt-id/submit')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ answers: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already completed/);
  });
});

// ── GET /api/tests/attempts/my ─────────────────────────────────────────────

describe('GET /api/tests/attempts/my', () => {
  it('returns 200 with freelancer test attempts', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'attempt-id', test_template_id: 'template-id',
        test_title: 'JS Test', test_category: 'Web Development',
        status: 'completed', passed: true, score: 25, max_score: 30
      }]
    });

    const res = await request(app)
      .get('/api/tests/attempts/my')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('attempts');
    expect(Array.isArray(res.body.attempts)).toBe(true);
  });

  it('returns 403 when client tries to access freelancer attempts', async () => {
    authClient();

    const res = await request(app)
      .get('/api/tests/attempts/my')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
  });
});
