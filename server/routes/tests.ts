import { Router } from 'express';
import { db } from '../index.ts';
import { AuthRequest, requireRole } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';

const router = Router();

// AI Test Generator Service
class AITestGenerator {
  static async generateQuestions(category: string, difficulty: string, count: number): Promise<any[]> {
    // This is a mock implementation - in production, this would call an LLM API
    const questionTemplates: Record<string, any[]> = {
      'Web Development': [
        {
          question_type: 'mcq',
          question_text: 'What is the purpose of the useEffect hook in React?',
          options: [
            'To handle side effects in functional components',
            'To create state variables',
            'To define component props',
            'To style components'
          ],
          correct_answer: 'To handle side effects in functional components',
          points: 10
        },
        {
          question_type: 'coding',
          question_text: 'Write a function that reverses a string in JavaScript.',
          points: 20
        },
        {
          question_type: 'written',
          question_text: 'Explain the difference between let, const, and var in JavaScript.',
          points: 15
        }
      ],
      'AI/ML': [
        {
          question_type: 'mcq',
          question_text: 'What is the primary purpose of gradient descent?',
          options: [
            'To minimize the loss function',
            'To increase model complexity',
            'To reduce training time',
            'To prevent overfitting'
          ],
          correct_answer: 'To minimize the loss function',
          points: 10
        },
        {
          question_type: 'written',
          question_text: 'Explain the bias-variance tradeoff in machine learning.',
          points: 20
        }
      ],
      'Design': [
        {
          question_type: 'mcq',
          question_text: 'What is the golden ratio in design?',
          options: ['1:1.618', '1:2', '2:3', '3:4'],
          correct_answer: '1:1.618',
          points: 10
        },
        {
          question_type: 'written',
          question_text: 'Describe the principles of good UI/UX design.',
          points: 20
        }
      ]
    };

    const templates = questionTemplates[category] || questionTemplates['Web Development'];
    const questions = [];
    
    for (let i = 0; i < Math.min(count, templates.length); i++) {
      questions.push({
        ...templates[i],
        order_index: i
      });
    }

    return questions;
  }

  static async evaluateAnswer(questionType: string, question: string, answer: string, correctAnswer?: string): Promise<{ score: number; feedback: string }> {
    // Mock AI evaluation - in production, this would use an LLM
    if (questionType === 'mcq') {
      const isCorrect = answer.trim().toLowerCase() === correctAnswer?.trim().toLowerCase();
      return {
        score: isCorrect ? 10 : 0,
        feedback: isCorrect ? 'Correct answer!' : 'Incorrect answer. Review the concept and try again.'
      };
    }

    if (questionType === 'coding') {
      // Simple heuristic - check if answer contains key concepts
      const hasCode = answer.includes('function') || answer.includes('=>');
      const hasLogic = answer.includes('return') || answer.includes('reverse');
      const score = hasCode && hasLogic ? Math.floor(Math.random() * 5) + 15 : Math.floor(Math.random() * 10) + 5;
      
      return {
        score,
        feedback: score > 15 
          ? 'Good solution! Your code is clean and efficient.' 
          : 'Your solution works but could be optimized. Consider edge cases and code readability.'
      };
    }

    // Written response
    const wordCount = answer.split(' ').length;
    const hasDetail = wordCount > 50;
    const score = hasDetail ? Math.floor(Math.random() * 5) + 12 : Math.floor(Math.random() * 8) + 5;

    return {
      score,
      feedback: hasDetail 
        ? 'Well explained! Your answer demonstrates good understanding.' 
        : 'Good attempt. Try to provide more detail and examples in your answer.'
    };
  }
}

// Get all test templates
router.get('/templates', asyncHandler(async (req: AuthRequest, res) => {
  const { category, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let query = `
    SELECT t.*, 
      p.display_name as creator_name,
      (SELECT COUNT(*) FROM test_questions WHERE test_template_id = t.id) as question_count
    FROM test_templates t
    LEFT JOIN profiles p ON t.client_id = p.user_id
    WHERE 1=1
  `;

  const params: any[] = [];
  let paramIndex = 1;

  if (category) {
    query += ` AND t.category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(Number(limit), offset);

  const result = await db.query(query, params);

  res.json({ templates: result.rows });
}));

// Get single test template with questions
router.get('/templates/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const templateResult = await db.query(
    `SELECT t.*, p.display_name as creator_name
     FROM test_templates t
     LEFT JOIN profiles p ON t.client_id = p.user_id
     WHERE t.id = $1`,
    [id]
  );

  if (templateResult.rows.length === 0) {
    return res.status(404).json({ error: 'Test template not found' });
  }

  const template = templateResult.rows[0];

  // Get questions
  const questionsResult = await db.query(
    `SELECT id, question_type, question_text, options, points, order_index
     FROM test_questions
     WHERE test_template_id = $1
     ORDER BY order_index`,
    [id]
  );

  template.questions = questionsResult.rows;

  res.json({ template });
}));

// Create test template (client)
router.post('/templates', requireRole(['client', 'admin']), asyncHandler(async (req: AuthRequest, res) => {
  const {
    title,
    description,
    category,
    durationMinutes,
    passingScore,
    isAIGenerated,
    questions
  } = req.body;

  if (!title || !category || !durationMinutes || !passingScore) {
    return res.status(400).json({
      error: 'Title, category, duration, and passing score are required'
    });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Create template
    const templateResult = await client.query(
      `INSERT INTO test_templates (client_id, title, description, category, duration_minutes, passing_score, is_ai_generated)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user!.userId,
        title,
        description,
        category,
        durationMinutes,
        passingScore,
        isAIGenerated || false
      ]
    );

    const template = templateResult.rows[0];

    // Generate or add questions
    if (isAIGenerated) {
      const aiQuestions = await AITestGenerator.generateQuestions(category, 'intermediate', 5);
      for (const q of aiQuestions) {
        await client.query(
          `INSERT INTO test_questions (test_template_id, question_type, question_text, options, correct_answer, points, order_index)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            template.id,
            q.question_type,
            q.question_text,
            q.options ? JSON.stringify(q.options) : null,
            q.correct_answer || null,
            q.points,
            q.order_index
          ]
        );
      }
    } else if (questions && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await client.query(
          `INSERT INTO test_questions (test_template_id, question_type, question_text, options, correct_answer, points, order_index)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            template.id,
            q.questionType,
            q.questionText,
            q.options ? JSON.stringify(q.options) : null,
            q.correctAnswer || null,
            q.points || 10,
            i
          ]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Test template created successfully',
      template
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Start test attempt
router.post('/attempts', requireRole(['freelancer', 'admin']), asyncHandler(async (req: AuthRequest, res) => {
  const { testTemplateId } = req.body;

  if (!testTemplateId) {
    return res.status(400).json({ error: 'Test template ID is required' });
  }

  // Get test template
  const templateResult = await db.query(
    'SELECT * FROM test_templates WHERE id = $1',
    [testTemplateId]
  );

  if (templateResult.rows.length === 0) {
    return res.status(404).json({ error: 'Test template not found' });
  }

  const template = templateResult.rows[0];

  // Check if already attempted
  const existingResult = await db.query(
    `SELECT * FROM test_attempts 
     WHERE test_template_id = $1 AND user_id = $2 AND status = 'completed'`,
    [testTemplateId, req.user!.userId]
  );

  if (existingResult.rows.length > 0) {
    return res.status(400).json({
      error: 'You have already completed this test',
      previousAttempt: existingResult.rows[0]
    });
  }

  // Get questions
  const questionsResult = await db.query(
    `SELECT id, question_type, question_text, options, points, order_index
     FROM test_questions
     WHERE test_template_id = $1
     ORDER BY order_index`,
    [testTemplateId]
  );

  // Create attempt
  const attemptResult = await db.query(
    `INSERT INTO test_attempts (test_template_id, user_id, max_score, status)
     VALUES ($1, $2, $3, 'in_progress')
     RETURNING *`,
    [
      testTemplateId,
      req.user!.userId,
      questionsResult.rows.reduce((sum, q) => sum + q.points, 0)
    ]
  );

  res.status(201).json({
    attempt: attemptResult.rows[0],
    template: {
      id: template.id,
      title: template.title,
      description: template.description,
      durationMinutes: template.duration_minutes,
      passingScore: template.passing_score
    },
    questions: questionsResult.rows
  });
}));

// Submit test answers
router.post('/attempts/:id/submit', requireRole(['freelancer', 'admin']), asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { answers } = req.body;

  // Get attempt
  const attemptResult = await db.query(
    `SELECT ta.*, tt.passing_score
     FROM test_attempts ta
     JOIN test_templates tt ON ta.test_template_id = tt.id
     WHERE ta.id = $1 AND ta.user_id = $2`,
    [id, req.user!.userId]
  );

  if (attemptResult.rows.length === 0) {
    return res.status(404).json({ error: 'Test attempt not found' });
  }

  const attempt = attemptResult.rows[0];

  if (attempt.status !== 'in_progress') {
    return res.status(400).json({ error: 'Test already completed' });
  }

  // Get questions with answers
  const questionsResult = await db.query(
    'SELECT * FROM test_questions WHERE test_template_id = $1',
    [attempt.test_template_id]
  );

  const questions = questionsResult.rows;

  // Evaluate answers
  let totalScore = 0;
  const evaluatedAnswers = [];
  let feedback = '';

  for (const question of questions) {
    const answer = answers.find((a: any) => a.questionId === question.id);
    
    if (answer) {
      const evaluation = await AITestGenerator.evaluateAnswer(
        question.question_type,
        question.question_text,
        answer.answer,
        question.correct_answer
      );

      totalScore += evaluation.score;
      evaluatedAnswers.push({
        questionId: question.id,
        answer: answer.answer,
        score: evaluation.score,
        maxScore: question.points,
        feedback: evaluation.feedback
      });
    }
  }

  const percentage = (totalScore / attempt.max_score) * 100;
  const passed = percentage >= attempt.passing_score;

  // Update attempt
  await db.query(
    `UPDATE test_attempts 
     SET score = $1, percentage = $2, passed = $3, answers = $4, 
         ai_feedback = $5, status = 'completed', completed_at = CURRENT_TIMESTAMP
     WHERE id = $6`,
    [
      totalScore,
      percentage,
      passed,
      JSON.stringify(evaluatedAnswers),
      feedback,
      id
    ]
  );

  res.json({
    message: 'Test submitted successfully',
    result: {
      score: totalScore,
      maxScore: attempt.max_score,
      percentage,
      passed,
      answers: evaluatedAnswers
    }
  });
}));

// Get my test attempts
router.get('/attempts/my', requireRole(['freelancer', 'admin']), asyncHandler(async (req: AuthRequest, res) => {
  const query = `
    SELECT 
      ta.*,
      tt.title as test_title,
      tt.category as test_category,
      tt.passing_score
    FROM test_attempts ta
    JOIN test_templates tt ON ta.test_template_id = tt.id
    WHERE ta.user_id = $1
    ORDER BY ta.created_at DESC
  `;

  const result = await db.query(query, [req.user!.userId]);

  res.json({ attempts: result.rows });
}));

export default router;
