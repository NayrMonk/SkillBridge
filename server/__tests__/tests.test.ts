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

// Mock AITestGenerator
jest.mock('../routes/tests.ts', () => {
  const actual = jest.requireActual('../routes/tests.ts');
  
  // Mock the AITestGenerator class methods
  actual.AITestGenerator.generateQuestions = jest.fn();
  actual.AITestGenerator.evaluateAnswer = jest.fn();
  
  return actual;
});

// Import after mocking
import * as testRoutes from '../routes/tests';

const mockGenerateQuestions = testRoutes.AITestGenerator.generateQuestions as jest.Mock;
const mockEvaluateAnswer = testRoutes.AITestGenerator.evaluateAnswer as jest.Mock;

beforeEach(() => {
  mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
  // Reset all mocks to prevent interference
  mockQuery.mockReset();
  mockClientQuery.mockReset();
  mockClientRelease.mockReset();
  mockGenerateQuestions.mockReset();
  mockEvaluateAnswer.mockReset();
  
  // Set default implementations
  mockGenerateQuestions.mockResolvedValue([
    {
      question_type: 'mcq',
      question_text: 'AI Generated Question 1?',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'A',
      points: 10
    },
    {
      question_type: 'coding',
      question_text: 'AI Generated Coding Question',
      points: 20
    }
  ]);
  mockEvaluateAnswer.mockResolvedValue({
    score: 0,
    feedback: 'Default feedback',
    correct: false
  });
});

const authFreelancer = () => mockQuery.mockResolvedValueOnce({ rows: [activeFreelancerRow] });
const authClient = () => mockQuery.mockResolvedValueOnce({ rows: [activeClientRow] });
const authAdmin = () => mockQuery.mockResolvedValueOnce({ rows: [activeAdminRow] });

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

  it('supports pagination with page and limit', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ ...sampleTemplate, question_count: '5' }] });

    const res = await request(app)
      .get('/api/tests/templates?page=2&limit=10')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('templates');
  });

  it('returns empty array when no templates match category', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/tests/templates?category=NonExistent')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(0);
  });

  it('handles invalid page parameter gracefully', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ ...sampleTemplate, question_count: '5' }] });

    const res = await request(app)
      .get('/api/tests/templates?page=invalid&limit=10')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('templates');
  });

  it('handles negative limit parameter', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ ...sampleTemplate, question_count: '5' }] });

    const res = await request(app)
      .get('/api/tests/templates?page=1&limit=-5')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('templates');
  });

  it('returns 401 when no token', async () => {
    const res = await request(app).get('/api/tests/templates');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/tests/templates')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
  });

  it('returns 401 with expired token', async () => {
    const res = await request(app)
      .get('/api/tests/templates')
      .set('Authorization', 'Bearer expired.token.here');

    expect(res.status).toBe(401);
  });

  it('allows admin access to templates', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({ rows: [{ ...sampleTemplate, question_count: '5' }] });

    const res = await request(app)
      .get('/api/tests/templates')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('templates');
  });

  it('handles database connection error', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

    const res = await request(app)
      .get('/api/tests/templates')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
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

  it('returns template with multiple question types', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleTemplate] })
      .mockResolvedValueOnce({
        rows: [
          { id: 'q1', question_type: 'mcq', question_text: 'MCQ question', points: 10, options: ['A', 'B', 'C'] },
          { id: 'q2', question_type: 'coding', question_text: 'Code this function', points: 20 },
          { id: 'q3', question_type: 'written', question_text: 'Explain concept', points: 15 }
        ]
      });

    const res = await request(app)
      .get('/api/tests/templates/template-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.template.questions).toHaveLength(3);
    expect(res.body.template.questions[0].question_type).toBe('mcq');
    expect(res.body.template.questions[1].question_type).toBe('coding');
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

  it('returns 404 for invalid UUID format', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/tests/templates/invalid-uuid')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Test template not found');
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/tests/templates/template-id');
    expect(res.status).toBe(401);
  });

  it('returns empty questions array when template has no questions', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleTemplate] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/tests/templates/template-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.template.questions).toHaveLength(0);
  });

  it('handles database error during template fetch', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('Database error'));

    const res = await request(app)
      .get('/api/tests/templates/template-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });

  it('handles database error during questions fetch', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleTemplate] })
      .mockRejectedValueOnce(new Error('Database error'));

    const res = await request(app)
      .get('/api/tests/templates/template-id')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });
});

// ── POST /api/tests/templates ──────────────────────────────────────────────

describe('POST /api/tests/templates', () => {
  beforeEach(() => {
    mockClientQuery.mockClear();
    mockClientRelease.mockClear();
  });

  it('returns 201 when client creates test template with manual questions', async () => {
    authClient();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [sampleTemplate] }) // insert template
      .mockResolvedValueOnce({ rows: [] }) // insert question 1
      .mockResolvedValueOnce({ rows: [] }) // insert question 2
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'JS Test',
        description: 'JavaScript fundamentals test',
        category: 'Web Development',
        durationMinutes: 60,
        passingScore: 70,
        questions: [
          { questionType: 'mcq', questionText: 'What is JS?', options: ['Language', 'Framework'], correctAnswer: 'Language', points: 10 },
          { questionType: 'coding', questionText: 'Write a function', points: 20 }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('template');
    expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
  });

  it('returns 201 when client creates AI-generated test template', async () => {
    authClient();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [sampleTemplate] }) // insert template
      .mockResolvedValueOnce({ rows: [] }) // insert AI question 1
      .mockResolvedValueOnce({ rows: [] }) // insert AI question 2
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'AI Generated Test',
        category: 'Web Development',
        durationMinutes: 45,
        passingScore: 75,
        isAIGenerated: true
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
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when title is empty', async () => {
    authClient();

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: '',
        category: 'Web Development',
        durationMinutes: 60,
        passingScore: 70
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when category is empty', async () => {
    authClient();

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Test',
        category: '',
        durationMinutes: 60,
        passingScore: 70
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when durationMinutes is invalid', async () => {
    authClient();

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Test',
        category: 'Web Development',
        durationMinutes: -10,
        passingScore: 70
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when passingScore is out of range', async () => {
    authClient();

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Test',
        category: 'Web Development',
        durationMinutes: 60,
        passingScore: 150
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when questions array is empty for manual template', async () => {
    authClient();

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Test',
        category: 'Web Development',
        durationMinutes: 60,
        passingScore: 70,
        questions: []
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when question has invalid type', async () => {
    authClient();

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Test',
        category: 'Web Development',
        durationMinutes: 60,
        passingScore: 70,
        questions: [
          { questionType: 'invalid', questionText: 'Question', points: 10 }
        ]
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/questionType must be one of/i);
  });

  it('returns 403 when freelancer tries to create template', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ title: 'Test', category: 'Web Dev', durationMinutes: 30, passingScore: 70 });

    expect(res.status).toBe(403);
  });

  it('allows admin to create test template', async () => {
    authAdmin();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [sampleTemplate] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Admin Test',
        category: 'Web Development',
        durationMinutes: 60,
        passingScore: 70,
        isAIGenerated: true
      });

    expect(res.status).toBe(201);
  });

  it('handles transaction rollback on database error', async () => {
    authClient();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce(new Error('Insert failed')); // template insert fails

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Test',
        category: 'Web Development',
        durationMinutes: 60,
        passingScore: 70,
        questions: [{ 
          questionType: 'mcq', 
          questionText: 'Q', 
          options: ['A', 'B'], 
          correctAnswer: 'A',
          points: 10 
        }]
      });

    expect(res.status).toBe(500);
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
  });

  it('handles question insertion failure', async () => {
    authClient();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [sampleTemplate] }) // template insert
      .mockRejectedValueOnce(new Error('Question insert failed')); // question insert fails

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Test',
        category: 'Web Development',
        durationMinutes: 60,
        passingScore: 70,
        questions: [{ 
          questionType: 'mcq', 
          questionText: 'Q', 
          options: ['A', 'B'], 
          correctAnswer: 'A',
          points: 10 
        }]
      });

    expect(res.status).toBe(500);
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
  });

  it('creates template with file_upload question type', async () => {
    authClient();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [sampleTemplate] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'File Upload Test',
        category: 'Design',
        durationMinutes: 90,
        passingScore: 80,
        questions: [
          { questionType: 'file_upload', questionText: 'Upload your design', points: 25 }
        ]
      });

    expect(res.status).toBe(201);
  });

  it('handles large number of questions', async () => {
    authClient();
    const questions = Array.from({ length: 50 }, (_, i) => ({
      questionType: 'mcq',
      questionText: `Question ${i + 1}`,
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      points: 2
    }));

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [sampleTemplate] })
      .mockResolvedValue({ rows: [] }); // 50 question inserts + commit

    const res = await request(app)
      .post('/api/tests/templates')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Large Test',
        category: 'Web Development',
        durationMinutes: 120,
        passingScore: 60,
        questions
      });

    expect(res.status).toBe(201);
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
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when testTemplateId is empty string', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/tests/attempts')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ testTemplateId: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
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

  it('allows admin to start a test', async () => {
    authAdmin();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleTemplate] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'q1', points: 10 }] })
      .mockResolvedValueOnce({ rows: [sampleAttempt] });

    const res = await request(app)
      .post('/api/tests/attempts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ testTemplateId: 'template-id' });

    expect(res.status).toBe(201);
  });

  it('calculates max_score correctly from questions', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleTemplate] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { id: 'q1', points: 15 },
          { id: 'q2', points: 25 },
          { id: 'q3', points: 10 }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ ...sampleAttempt, max_score: 50 }] });

    const res = await request(app)
      .post('/api/tests/attempts')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ testTemplateId: 'template-id' });

    expect(res.status).toBe(201);
    expect(res.body.attempt.max_score).toBe(50);
  });

  it('handles template with no questions', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleTemplate] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] }) // no questions
      .mockResolvedValueOnce({ rows: [{ ...sampleAttempt, max_score: 0 }] });

    const res = await request(app)
      .post('/api/tests/attempts')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ testTemplateId: 'template-id' });

    expect(res.status).toBe(201);
    expect(res.body.attempt.max_score).toBe(0);
    expect(res.body.questions).toHaveLength(0);
  });

  it('handles database error during template check', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('Database error'));

    const res = await request(app)
      .post('/api/tests/attempts')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ testTemplateId: 'template-id' });

    expect(res.status).toBe(500);
  });

  it('handles database error during completion check', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleTemplate] })
      .mockRejectedValueOnce(new Error('Database error'));

    const res = await request(app)
      .post('/api/tests/attempts')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ testTemplateId: 'template-id' });

    expect(res.status).toBe(500);
  });

  it('handles database error during questions fetch', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleTemplate] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('Database error'));

    const res = await request(app)
      .post('/api/tests/attempts')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ testTemplateId: 'template-id' });

    expect(res.status).toBe(500);
  });

  it('handles database error during attempt creation', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleTemplate] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'q1', points: 10 }] })
      .mockRejectedValueOnce(new Error('Database error'));

    const res = await request(app)
      .post('/api/tests/attempts')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ testTemplateId: 'template-id' });

    expect(res.status).toBe(500);
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

  it('calculates score correctly for correct MCQ answer', async () => {
    mockEvaluateAnswer.mockResolvedValue({ score: 10, feedback: 'Correct answer!' });
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ ...sampleAttempt, passing_score: 70, max_score: 10 }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'q1', question_type: 'mcq', question_text: 'Q1?',
          correct_answer: 'Correct Answer', points: 10, order_index: 0
        }]
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/tests/attempts/attempt-id/submit')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ answers: [{ questionId: 'q1', answer: 'Correct Answer' }] });

    expect(res.status).toBe(200);
    expect(res.body.result.score).toBe(10);
    expect(res.body.result.percentage).toBe(100);
    expect(res.body.result.passed).toBe(true);
  });

  it('calculates score correctly for incorrect MCQ answer', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ ...sampleAttempt, passing_score: 70, max_score: 10 }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'q1', question_type: 'mcq', question_text: 'Q1?',
          correct_answer: 'Correct', points: 10, order_index: 0
        }]
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/tests/attempts/attempt-id/submit')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ answers: [{ questionId: 'q1', answer: 'Wrong' }] });

    expect(res.status).toBe(200);
    expect(res.body.result.score).toBe(0);
    expect(res.body.result.percentage).toBe(0);
    expect(res.body.result.passed).toBe(false);
  });

  it('handles multiple questions with mixed results', async () => {
    mockEvaluateAnswer
      .mockResolvedValueOnce({ score: 10, feedback: 'Correct!' }) // q1 correct MCQ
      .mockResolvedValueOnce({ score: 0, feedback: 'Incorrect!' }) // q2 incorrect MCQ
      .mockResolvedValueOnce({ score: 15, feedback: 'Good code!' }); // q3 coding
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ ...sampleAttempt, passing_score: 50, max_score: 30 }]
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 'q1', question_type: 'mcq', correct_answer: 'A', points: 10 },
          { id: 'q2', question_type: 'mcq', correct_answer: 'B', points: 10 },
          { id: 'q3', question_type: 'coding', correct_answer: null, points: 10 }
        ]
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/tests/attempts/attempt-id/submit')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({
        answers: [
          { questionId: 'q1', answer: 'A' }, // correct
          { questionId: 'q2', answer: 'C' }, // incorrect
          { questionId: 'q3', answer: 'some code' } // coding question
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.result.score).toBe(25); // 10 + 0 + 15
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

  it('returns 400 when answers is not an array', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...sampleAttempt, passing_score: 70, max_score: 30 }]
    });

    const res = await request(app)
      .post('/api/tests/attempts/attempt-id/submit')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ answers: 'not an array' });

    expect(res.status).toBe(400);
  });

  it('handles empty answers array', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ ...sampleAttempt, passing_score: 70, max_score: 30 }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'q1', question_type: 'mcq', question_text: 'Q1?',
          correct_answer: 'A', points: 10, order_index: 0
        }]
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/tests/attempts/attempt-id/submit')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ answers: [] });

    expect(res.status).toBe(200);
    expect(res.body.result.score).toBe(0); // no answers provided
  });

  it('handles invalid attempt ID format', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/tests/attempts/invalid-id/submit')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ answers: [] });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Test attempt not found');
  });

  it('returns 403 when client tries to submit test', async () => {
    authClient();

    const res = await request(app)
      .post('/api/tests/attempts/attempt-id/submit')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ answers: [] });

    expect(res.status).toBe(403);
  });

  it('allows admin to submit test', async () => {
    authAdmin();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ ...sampleAttempt, passing_score: 70, max_score: 30 }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'q1', question_type: 'mcq', question_text: 'Q1?',
          correct_answer: 'A', points: 10, order_index: 0
        }]
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/tests/attempts/attempt-id/submit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ answers: [{ questionId: 'q1', answer: 'A' }] });

    expect(res.status).toBe(200);
  });

  it('handles database error during attempt fetch', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('Database error'));

    const res = await request(app)
      .post('/api/tests/attempts/attempt-id/submit')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ answers: [] });

    expect(res.status).toBe(500);
  });

  it('handles database error during questions fetch', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ ...sampleAttempt, passing_score: 70, max_score: 30 }]
      })
      .mockRejectedValueOnce(new Error('Database error'));

    const res = await request(app)
      .post('/api/tests/attempts/attempt-id/submit')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ answers: [] });

    expect(res.status).toBe(500);
  });

  it('handles database error during attempt update', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ ...sampleAttempt, passing_score: 70, max_score: 30 }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'q1', question_type: 'mcq', question_text: 'Q1?',
          correct_answer: 'A', points: 10, order_index: 0
        }]
      })
      .mockRejectedValueOnce(new Error('Database error'));

    const res = await request(app)
      .post('/api/tests/attempts/attempt-id/submit')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ answers: [{ questionId: 'q1', answer: 'A' }] });

    expect(res.status).toBe(500);
  });

  it('handles coding question evaluation', async () => {
    mockEvaluateAnswer.mockResolvedValue({ score: 18, feedback: 'Good code implementation' });
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ ...sampleAttempt, passing_score: 50, max_score: 20 }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'q1', question_type: 'coding', question_text: 'Write a function to reverse a string',
          correct_answer: null, points: 20, order_index: 0
        }]
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/tests/attempts/attempt-id/submit')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ answers: [{ questionId: 'q1', answer: 'function reverse(str) { return str.split("").reverse().join(""); }' }] });

    expect(res.status).toBe(200);
    expect(res.body.result.score).toBeGreaterThanOrEqual(15); // should get high score for correct code
  });

  it('handles written question evaluation', async () => {
    mockEvaluateAnswer.mockResolvedValue({ score: 13, feedback: 'Good explanation' });
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ ...sampleAttempt, passing_score: 50, max_score: 15 }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'q1', question_type: 'written', question_text: 'Explain what a closure is in JavaScript',
          correct_answer: null, points: 15, order_index: 0
        }]
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/tests/attempts/attempt-id/submit')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ answers: [{ questionId: 'q1', answer: 'A closure is a function that has access to variables in its outer scope even after the outer function has returned.' }] });

    expect(res.status).toBe(200);
    expect(res.body.result.score).toBeGreaterThanOrEqual(12); // should get high score for detailed answer
  });

  it('calculates percentage correctly', async () => {
    mockEvaluateAnswer.mockResolvedValue({ score: 10, feedback: 'Correct answer!' });
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ ...sampleAttempt, passing_score: 60, max_score: 20 }]
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 'q1', question_type: 'mcq', correct_answer: 'A', points: 10 },
          { id: 'q2', question_type: 'mcq', correct_answer: 'B', points: 10 }
        ]
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/tests/attempts/attempt-id/submit')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({
        answers: [
          { questionId: 'q1', answer: 'A' }, // correct
          { questionId: 'q2', answer: 'B' }  // correct
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.result.percentage).toBe(100);
    expect(res.body.result.passed).toBe(true);
  });

  it('handles case insensitive MCQ answers', async () => {
    mockEvaluateAnswer.mockResolvedValue({ score: 10, feedback: 'Correct answer!' });
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ ...sampleAttempt, passing_score: 70, max_score: 10 }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'q1', question_type: 'mcq', question_text: 'Q1?',
          correct_answer: 'JavaScript', points: 10, order_index: 0
        }]
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/tests/attempts/attempt-id/submit')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ answers: [{ questionId: 'q1', answer: 'javascript' }] });

    expect(res.status).toBe(200);
    expect(res.body.result.score).toBe(10);
    expect(res.body.result.passed).toBe(true);
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

  it('returns multiple attempts ordered by creation date', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'attempt-2', test_template_id: 'template-2',
          test_title: 'React Test', test_category: 'Web Development',
          status: 'completed', passed: false, score: 15, max_score: 30,
          created_at: '2024-01-02T00:00:00Z'
        },
        {
          id: 'attempt-1', test_template_id: 'template-1',
          test_title: 'JS Test', test_category: 'Web Development',
          status: 'completed', passed: true, score: 25, max_score: 30,
          created_at: '2024-01-01T00:00:00Z'
        }
      ]
    });

    const res = await request(app)
      .get('/api/tests/attempts/my')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attempts).toHaveLength(2);
    expect(res.body.attempts[0].id).toBe('attempt-2'); // most recent first
  });

  it('returns empty array when no attempts exist', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/tests/attempts/my')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attempts).toHaveLength(0);
  });

  it('returns 403 when client tries to access freelancer attempts', async () => {
    authClient();

    const res = await request(app)
      .get('/api/tests/attempts/my')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
  });

  it('allows admin to access attempts', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'attempt-id', test_template_id: 'template-id',
        test_title: 'Admin Test', test_category: 'Web Development',
        status: 'completed', passed: true, score: 25, max_score: 30
      }]
    });

    const res = await request(app)
      .get('/api/tests/attempts/my')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attempts).toHaveLength(1);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/tests/attempts/my');
    expect(res.status).toBe(401);
  });

  it('handles database error', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('Database error'));

    const res = await request(app)
      .get('/api/tests/attempts/my')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });

  it('includes all required attempt fields', async () => {
    authFreelancer();
    const fullAttempt = {
      id: 'attempt-id',
      test_template_id: 'template-id',
      user_id: 'freelancer-user-id',
      started_at: '2024-01-01T00:00:00Z',
      completed_at: '2024-01-01T01:00:00Z',
      score: 25,
      max_score: 30,
      percentage: 83.33,
      passed: true,
      ai_feedback: 'Good job!',
      answers: [{ questionId: 'q1', answer: 'A', score: 10 }],
      status: 'completed',
      test_title: 'JS Test',
      test_category: 'Web Development',
      passing_score: 70
    };

    mockQuery.mockResolvedValueOnce({ rows: [fullAttempt] });

    const res = await request(app)
      .get('/api/tests/attempts/my')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    const attempt = res.body.attempts[0];
    expect(attempt).toHaveProperty('id');
    expect(attempt).toHaveProperty('test_title');
    expect(attempt).toHaveProperty('test_category');
    expect(attempt).toHaveProperty('status');
    expect(attempt).toHaveProperty('passed');
    expect(attempt).toHaveProperty('score');
    expect(attempt).toHaveProperty('max_score');
    expect(attempt).toHaveProperty('percentage');
  });

  it('handles in-progress attempts', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'attempt-id', test_template_id: 'template-id',
        test_title: 'JS Test', test_category: 'Web Development',
        status: 'in_progress', passed: null, score: null, max_score: 30
      }]
    });

    const res = await request(app)
      .get('/api/tests/attempts/my')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    const attempt = res.body.attempts[0];
    expect(attempt.status).toBe('in_progress');
    expect(attempt.passed).toBeNull();
    expect(attempt.score).toBeNull();
  });

  it('handles timed out attempts', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'attempt-id', test_template_id: 'template-id',
        test_title: 'JS Test', test_category: 'Web Development',
        status: 'timed_out', passed: false, score: 0, max_score: 30
      }]
    });

    const res = await request(app)
      .get('/api/tests/attempts/my')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    const attempt = res.body.attempts[0];
    expect(attempt.status).toBe('timed_out');
    expect(attempt.passed).toBe(false);
  });
});
