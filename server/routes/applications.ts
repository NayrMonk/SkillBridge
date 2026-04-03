import { Router } from 'express';
import { db } from '../index.ts';
import { AuthRequest, requireRole } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';

const router = Router();

// Get my applications (freelancer)
router.get('/my', requireRole(['freelancer', 'admin']), asyncHandler(async (req: AuthRequest, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let query = `
    SELECT 
      a.*,
      p.title as project_title,
      p.category as project_category,
      p.budget_min,
      p.budget_max,
      p.budget_type,
      p.status as project_status,
      pr.display_name as client_name,
      pr.avatar_url as client_avatar
    FROM applications a
    JOIN projects p ON a.project_id = p.id
    JOIN profiles pr ON p.client_id = pr.user_id
    WHERE a.freelancer_id = $1
  `;

  const params: any[] = [req.user!.userId];
  let paramIndex = 2;

  if (status) {
    query += ` AND a.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(Number(limit), offset);

  const result = await db.query(query, params);

  // Get total count
  let countQuery = 'SELECT COUNT(*) FROM applications WHERE freelancer_id = $1';
  const countParams: any[] = [req.user!.userId];

  if (status) {
    countQuery += ' AND status = $2';
    countParams.push(status);
  }

  const countResult = await db.query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].count);

  res.json({
    applications: result.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit))
    }
  });
}));

// Get applications for my project (client)
router.get('/project/:projectId', requireRole(['client', 'admin']), asyncHandler(async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const { status } = req.query;

  // Verify project ownership
  const projectResult = await db.query(
    'SELECT client_id FROM projects WHERE id = $1',
    [projectId]
  );

  if (projectResult.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const project = projectResult.rows[0];

  if (project.client_id !== req.user!.userId && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  let query = `
    SELECT 
      a.*,
      p.title as project_title,
      pr.display_name as freelancer_name,
      pr.avatar_url as freelancer_avatar,
      pr.headline as freelancer_headline,
      pr.hourly_rate,
      pr.rating as freelancer_rating,
      pr.location as freelancer_location,
      (SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'category', s.category))
       FROM user_skills us
       JOIN skills s ON us.skill_id = s.id
       WHERE us.user_id = a.freelancer_id
       LIMIT 5) as skills
    FROM applications a
    JOIN projects p ON a.project_id = p.id
    JOIN profiles pr ON a.freelancer_id = pr.user_id
    WHERE a.project_id = $1
  `;

  const params: any[] = [projectId];

  if (status) {
    query += ` AND a.status = $2`;
    params.push(status);
  }

  query += ` ORDER BY 
    CASE a.status 
      WHEN 'pending' THEN 0 
      WHEN 'shortlisted' THEN 1 
      WHEN 'hired' THEN 2 
      ELSE 3 
    END,
    a.created_at DESC`;

  const result = await db.query(query, params);

  res.json({ applications: result.rows });
}));

// Submit application (freelancer)
router.post('/', requireRole(['freelancer', 'admin']), asyncHandler(async (req: AuthRequest, res) => {
  const {
    projectId,
    coverLetter,
    proposedBudget,
    proposedDuration,
    attachments
  } = req.body;

  if (!projectId || !coverLetter) {
    return res.status(400).json({
      error: 'Project ID and cover letter are required'
    });
  }

  // Check if project exists and is open
  const projectResult = await db.query(
    'SELECT client_id, status, required_tests FROM projects WHERE id = $1',
    [projectId]
  );

  if (projectResult.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const project = projectResult.rows[0];

  if (project.status !== 'open') {
    return res.status(400).json({ error: 'Project is not accepting applications' });
  }

  if (project.client_id === req.user!.userId) {
    return res.status(400).json({ error: 'Cannot apply to your own project' });
  }

  // Check if already applied
  const existingResult = await db.query(
    'SELECT id FROM applications WHERE project_id = $1 AND freelancer_id = $2',
    [projectId, req.user!.userId]
  );

  if (existingResult.rows.length > 0) {
    return res.status(409).json({ error: 'You have already applied to this project' });
  }

  // Check required tests
  if (project.required_tests && project.required_tests.length > 0) {
    const testAttemptsResult = await db.query(
      `SELECT test_template_id FROM test_attempts 
       WHERE user_id = $1 
       AND test_template_id = ANY($2) 
       AND passed = true`,
      [req.user!.userId, project.required_tests]
    );

    const passedTests = testAttemptsResult.rows.map(r => r.test_template_id);
    const requiredTests = project.required_tests;
    const missingTests = requiredTests.filter((t: string) => !passedTests.includes(t));

    if (missingTests.length > 0) {
      return res.status(400).json({
        error: 'Required tests not completed',
        missingTests
      });
    }
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Create application
    const applicationResult = await client.query(
      `INSERT INTO applications (
        project_id, freelancer_id, cover_letter, proposed_budget,
        proposed_duration, attachments
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        projectId,
        req.user!.userId,
        coverLetter,
        proposedBudget,
        proposedDuration,
        attachments || []
      ]
    );

    // Update project applications count
    await client.query(
      'UPDATE projects SET applications_count = applications_count + 1 WHERE id = $1',
      [projectId]
    );

    // Create notification for client
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       SELECT 
         client_id,
         'new_application',
         'New Application Received',
         'Someone applied to your project: ' || title,
         json_build_object('projectId', $1, 'applicationId', $2)
       FROM projects WHERE id = $1`,
      [projectId, applicationResult.rows[0].id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Application submitted successfully',
      application: applicationResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Update application status (client)
router.patch('/:id/status', requireRole(['client', 'admin']), asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!['shortlisted', 'rejected', 'hired'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  // Get application with project info
  const applicationResult = await db.query(
    `SELECT a.*, p.client_id, p.title as project_title, p.status as project_status
     FROM applications a
     JOIN projects p ON a.project_id = p.id
     WHERE a.id = $1`,
    [id]
  );

  if (applicationResult.rows.length === 0) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const application = applicationResult.rows[0];

  if (application.client_id !== req.user!.userId && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  if (application.status === 'hired') {
    return res.status(400).json({ error: 'Cannot change status of hired application' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Update application
    await client.query(
      `UPDATE applications 
       SET status = $1, client_notes = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [status, notes || null, id]
    );

    // If hired, create contract and update project
    if (status === 'hired') {
      // Check if project already has hired freelancer
      const existingContract = await client.query(
        'SELECT id FROM contracts WHERE project_id = $1 AND status = $2',
        [application.project_id, 'active']
      );

      if (existingContract.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Project already has an active contract' });
      }

      // Create contract
      await client.query(
        `INSERT INTO contracts (
          project_id, application_id, client_id, freelancer_id,
          agreed_budget, agreed_duration
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          application.project_id,
          application.id,
          application.client_id,
          application.freelancer_id,
          application.proposed_budget,
          application.proposed_duration
        ]
      );

      // Update project status
      await client.query(
        "UPDATE projects SET status = 'in_progress', hired_count = hired_count + 1 WHERE id = $1",
        [application.project_id]
      );

      // Reject other pending applications
      await client.query(
        `UPDATE applications 
         SET status = 'rejected', client_notes = 'Another freelancer was hired'
         WHERE project_id = $1 AND id != $2 AND status = 'pending'`,
        [application.project_id, application.id]
      );
    }

    // Create notification for freelancer
    const notificationType = status === 'hired' ? 'application_hired' : 
                            status === 'shortlisted' ? 'application_shortlisted' : 'application_rejected';
    const notificationTitle = status === 'hired' ? 'You were hired!' : 
                             status === 'shortlisted' ? 'You were shortlisted' : 'Application not selected';
    const notificationMessage = status === 'hired' 
      ? `Congratulations! You were hired for: ${application.project_title}`
      : status === 'shortlisted'
      ? `You were shortlisted for: ${application.project_title}`
      : `Your application was not selected for: ${application.project_title}`;

    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        application.freelancer_id,
        notificationType,
        notificationTitle,
        notificationMessage,
        JSON.stringify({ projectId: application.project_id, applicationId: application.id })
      ]
    );

    await client.query('COMMIT');

    res.json({
      message: `Application ${status} successfully`,
      status
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Withdraw application (freelancer)
router.delete('/:id', requireRole(['freelancer', 'admin']), asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const applicationResult = await db.query(
    'SELECT freelancer_id, status, project_id FROM applications WHERE id = $1',
    [id]
  );

  if (applicationResult.rows.length === 0) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const application = applicationResult.rows[0];

  if (application.freelancer_id !== req.user!.userId && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  if (application.status === 'hired') {
    return res.status(400).json({ error: 'Cannot withdraw hired application' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM applications WHERE id = $1', [id]);

    await client.query(
      'UPDATE projects SET applications_count = applications_count - 1 WHERE id = $1',
      [application.project_id]
    );

    await client.query('COMMIT');

    res.json({ message: 'Application withdrawn successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

export default router;
