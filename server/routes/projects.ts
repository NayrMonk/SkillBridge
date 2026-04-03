import { Router } from 'express';
import { db, redis } from '../index.ts';
import { AuthRequest, requireRole } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all projects with filters
router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const {
    category,
    skills,
    budget_min,
    budget_max,
    experience_level,
    search,
    status = 'open',
    promotion_tier,
    page = 1,
    limit = 20,
    sort_by = 'created_at',
    sort_order = 'desc'
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);
  
  let query = `
    SELECT 
      p.*,
      pr.display_name as client_name,
      pr.avatar_url as client_avatar,
      pr.rating as client_rating,
      COUNT(DISTINCT a.id) as application_count
    FROM projects p
    LEFT JOIN profiles pr ON p.client_id = pr.user_id
    LEFT JOIN applications a ON p.id = a.project_id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND p.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (category) {
    query += ` AND p.category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  if (experience_level) {
    query += ` AND p.experience_level = $${paramIndex}`;
    params.push(experience_level);
    paramIndex++;
  }

  if (promotion_tier) {
    query += ` AND p.promotion_tier = $${paramIndex}`;
    params.push(promotion_tier);
    paramIndex++;
  }

  if (budget_min) {
    query += ` AND p.budget_max >= $${paramIndex}`;
    params.push(budget_min);
    paramIndex++;
  }

  if (budget_max) {
    query += ` AND p.budget_min <= $${paramIndex}`;
    params.push(budget_max);
    paramIndex++;
  }

  if (skills) {
    const skillArray = Array.isArray(skills) ? skills : [skills];
    query += ` AND p.skills_required && $${paramIndex}`;
    params.push(skillArray);
    paramIndex++;
  }

  if (search) {
    query += ` AND (p.title ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  query += ` GROUP BY p.id, pr.display_name, pr.avatar_url, pr.rating`;

  // Sorting
  const allowedSortColumns = ['created_at', 'budget_max', 'budget_min', 'views', 'applications_count'];
  const sortColumn = allowedSortColumns.includes(sort_by as string) ? sort_by : 'created_at';
  const order = sort_order === 'asc' ? 'ASC' : 'DESC';
  
  query += ` ORDER BY 
    CASE WHEN p.promotion_tier = 'super_hot' THEN 0 
         WHEN p.promotion_tier = 'hot' THEN 1 
         ELSE 2 END,
    p.${sortColumn} ${order}`;

  query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(Number(limit), offset);

  const result = await db.query(query, params);

  // Get total count for pagination
  let countQuery = 'SELECT COUNT(*) FROM projects p WHERE 1=1';
  const countParams: any[] = [];
  let countIndex = 1;

  if (status) {
    countQuery += ` AND p.status = $${countIndex}`;
    countParams.push(status);
    countIndex++;
  }

  if (category) {
    countQuery += ` AND p.category = $${countIndex}`;
    countParams.push(category);
    countIndex++;
  }

  const countResult = await db.query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].count);

  res.json({
    projects: result.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit))
    }
  });
}));

// Get featured/top projects
router.get('/featured', asyncHandler(async (req, res) => {
  const query = `
    SELECT 
      p.*,
      pr.display_name as client_name,
      pr.avatar_url as client_avatar,
      pr.rating as client_rating,
      COUNT(DISTINCT a.id) as application_count
    FROM projects p
    LEFT JOIN profiles pr ON p.client_id = pr.user_id
    LEFT JOIN applications a ON p.id = a.project_id
    WHERE p.status = 'open'
    GROUP BY p.id, pr.display_name, pr.avatar_url, pr.rating
    ORDER BY 
      CASE WHEN p.promotion_tier = 'super_hot' THEN 0 
           WHEN p.promotion_tier = 'hot' THEN 1 
           ELSE 2 END,
      p.budget_max DESC,
      p.views DESC
    LIMIT 10
  `;

  const result = await db.query(query);

  res.json({
    projects: result.rows
  });
}));

// Get hot projects
router.get('/hot', asyncHandler(async (req, res) => {
  const query = `
    SELECT 
      p.*,
      pr.display_name as client_name,
      pr.avatar_url as client_avatar,
      pr.rating as client_rating,
      COUNT(DISTINCT a.id) as application_count
    FROM projects p
    LEFT JOIN profiles pr ON p.client_id = pr.user_id
    LEFT JOIN applications a ON p.id = a.project_id
    WHERE p.status = 'open'
      AND (p.promotion_tier = 'hot' OR p.promotion_tier = 'super_hot')
    GROUP BY p.id, pr.display_name, pr.avatar_url, pr.rating
    ORDER BY p.created_at DESC
    LIMIT 20
  `;

  const result = await db.query(query);

  res.json({
    projects: result.rows
  });
}));

// Get single project
router.get('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  // Increment views
  await db.query('UPDATE projects SET views = views + 1 WHERE id = $1', [id]);

  const query = `
    SELECT 
      p.*,
      pr.display_name as client_name,
      pr.avatar_url as client_avatar,
      pr.rating as client_rating,
      pr.bio as client_bio,
      pr.location as client_location,
      pr.total_spent as client_total_spent,
      pr.jobs_completed as client_jobs_completed,
      (SELECT COUNT(*) FROM applications WHERE project_id = p.id) as application_count
    FROM projects p
    LEFT JOIN profiles pr ON p.client_id = pr.user_id
    WHERE p.id = $1
  `;

  const result = await db.query(query, [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const project = result.rows[0];

  // Get required skills details
  if (project.skills_required && project.skills_required.length > 0) {
    const skillsResult = await db.query(
      'SELECT id, name, category FROM skills WHERE id = ANY($1)',
      [project.skills_required]
    );
    project.skills = skillsResult.rows;
  }

  // Get milestones
  const milestonesResult = await db.query(
    'SELECT * FROM milestones WHERE project_id = $1 ORDER BY order_index',
    [id]
  );
  project.milestones = milestonesResult.rows;

  // Get required tests
  const testsResult = await db.query(
    `SELECT t.* FROM test_templates t
     JOIN project_tests pt ON t.id = pt.test_template_id
     WHERE pt.project_id = $1`,
    [id]
  );
  project.requiredTests = testsResult.rows;

  // Check if user has applied
  if (req.user && req.user.role === 'freelancer') {
    const applicationResult = await db.query(
      'SELECT * FROM applications WHERE project_id = $1 AND freelancer_id = $2',
      [id, req.user.userId]
    );
    project.userApplication = applicationResult.rows[0] || null;
  }

  res.json({ project });
}));

// Create project (client only)
router.post('/', requireRole(['client', 'admin']), asyncHandler(async (req: AuthRequest, res) => {
  const {
    title,
    description,
    category,
    skillsRequired,
    budgetMin,
    budgetMax,
    budgetType,
    duration,
    experienceLevel,
    deadline,
    locationType,
    milestones,
    requiredTests,
    visibility
  } = req.body;

  // Validation
  if (!title || !description || !category) {
    return res.status(400).json({
      error: 'Title, description, and category are required'
    });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Create project
    const projectResult = await client.query(
      `INSERT INTO projects (
        client_id, title, description, category, skills_required,
        budget_min, budget_max, budget_type, duration, experience_level,
        deadline, location_type, visibility
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        req.user!.userId,
        title,
        description,
        category,
        skillsRequired || [],
        budgetMin,
        budgetMax,
        budgetType || 'fixed',
        duration,
        experienceLevel,
        deadline,
        locationType || 'remote',
        visibility || 'public'
      ]
    );

    const project = projectResult.rows[0];

    // Create milestones if provided
    if (milestones && milestones.length > 0) {
      for (let i = 0; i < milestones.length; i++) {
        const m = milestones[i];
        await client.query(
          `INSERT INTO milestones (project_id, title, description, amount, due_date, order_index)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [project.id, m.title, m.description, m.amount, m.dueDate, i]
        );
      }
    }

    // Link required tests if provided
    if (requiredTests && requiredTests.length > 0) {
      for (const testId of requiredTests) {
        await client.query(
          'INSERT INTO project_tests (project_id, test_template_id) VALUES ($1, $2)',
          [project.id, testId]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Update project
router.put('/:id', requireRole(['client', 'admin']), asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Check ownership
  const projectResult = await db.query(
    'SELECT client_id, status FROM projects WHERE id = $1',
    [id]
  );

  if (projectResult.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const project = projectResult.rows[0];

  if (project.client_id !== req.user!.userId && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to update this project' });
  }

  if (project.status === 'completed' || project.status === 'cancelled') {
    return res.status(400).json({ error: 'Cannot update completed or cancelled projects' });
  }

  const allowedUpdates = [
    'title', 'description', 'category', 'skills_required',
    'budget_min', 'budget_max', 'budget_type', 'duration',
    'experience_level', 'deadline', 'location_type', 'visibility'
  ];

  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(updates[key]);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  values.push(id);

  const query = `
    UPDATE projects 
    SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await db.query(query, values);


  res.json({
    message: 'Project updated successfully',
    project: result.rows[0]
  });
}));

// Delete/Cancel project
router.delete('/:id', requireRole(['client', 'admin']), asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const projectResult = await db.query(
    'SELECT client_id, status FROM projects WHERE id = $1',
    [id]
  );

  if (projectResult.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const project = projectResult.rows[0];

  if (project.client_id !== req.user!.userId && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // Soft delete by setting status to cancelled
  await db.query(
    "UPDATE projects SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
    [id]
  );

  // Reject all pending applications
  await db.query(
    "UPDATE applications SET status = 'rejected' WHERE project_id = $1 AND status = 'pending'",
    [id]
  );

  res.json({ message: 'Project cancelled successfully' });
}));

// Promote project
router.post('/:id/promote', requireRole(['client', 'admin']), asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { tier } = req.body;

  if (!['hot', 'super_hot'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid promotion tier' });
  }

  const projectResult = await db.query(
    'SELECT client_id, promotion_tier FROM projects WHERE id = $1',
    [id]
  );

  if (projectResult.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const project = projectResult.rows[0];

  if (project.client_id !== req.user!.userId && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // Get promotion price
  const settingsResult = await db.query(
    'SELECT value FROM platform_settings WHERE key = $1',
    [tier === 'hot' ? 'hot_project_price' : 'super_hot_project_price']
  );

  const price = parseFloat(settingsResult.rows[0]?.value || (tier === 'hot' ? '49.99' : '99.99'));

  // Check wallet balance
  const walletResult = await db.query(
    'SELECT balance FROM wallets WHERE user_id = $1',
    [req.user!.userId]
  );

  const wallet = walletResult.rows[0];

  if (!wallet || wallet.balance < price) {
    return res.status(400).json({
      error: 'Insufficient balance',
      required: price,
      current: wallet?.balance || 0
    });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Deduct from wallet
    await client.query(
      'UPDATE wallets SET balance = balance - $1, total_spent = total_spent + $1 WHERE user_id = $2',
      [price, req.user!.userId]
    );

    // Create transaction record
    await client.query(
      `INSERT INTO transactions (wallet_id, user_id, type, amount, description, project_id)
       SELECT w.id, $1, 'promotion_payment', $2, $3, $4
       FROM wallets w WHERE w.user_id = $1`,
      [req.user!.userId, price, `Project promotion to ${tier}`, id]
    );

    // Update project promotion
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days promotion

    await client.query(
      `UPDATE projects 
       SET promotion_tier = $1, promotion_expires_at = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [tier, expiresAt, id]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Project promoted successfully',
      tier,
      expiresAt
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Get project categories
router.get('/categories/list', asyncHandler(async (req, res) => {
  const result = await db.query(
    'SELECT category, COUNT(*) as project_count FROM projects WHERE status = $1 GROUP BY category',
    ['open']
  );

  res.json({ categories: result.rows });
}));

export default router;

