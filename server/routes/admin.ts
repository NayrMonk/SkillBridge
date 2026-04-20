import { Router } from 'express';
import { db } from '../index.ts';
import { AuthRequest, requireAdmin } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';

const router = Router();

// All routes require admin role
router.use(requireAdmin);

// Get dashboard stats
router.get('/stats', asyncHandler(async (req: AuthRequest, res) => {
  const stats = await Promise.all([
    // Total users
    db.query("SELECT COUNT(*) as count FROM users WHERE status = 'active'"),
    // Users by role
    db.query("SELECT role, COUNT(*) as count FROM users WHERE status = 'active' GROUP BY role"),
    // Total projects
    db.query("SELECT COUNT(*) as count FROM projects"),
    // Projects by status
    db.query("SELECT status, COUNT(*) as count FROM projects GROUP BY status"),
    // Total transactions
    db.query("SELECT COUNT(*) as count FROM transactions WHERE status = 'completed'"),
    // Total volume
    db.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = 'completed'"),
    // Active contracts
    db.query("SELECT COUNT(*) as count FROM contracts WHERE status = 'active'"),
    // Pending applications
    db.query("SELECT COUNT(*) as count FROM applications WHERE status = 'pending'"),
    // Recent users
    db.query(`
      SELECT u.id, u.email, u.role, u.created_at, p.display_name
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      ORDER BY u.created_at DESC
      LIMIT 10
    `),
    // Recent projects
    db.query(`
      SELECT p.*, pr.display_name as client_name
      FROM projects p
      LEFT JOIN profiles pr ON p.client_id = pr.user_id
      ORDER BY p.created_at DESC
      LIMIT 10
    `)
  ]);

  res.json({
    stats: {
      totalUsers: parseInt(stats[0].rows[0].count),
      usersByRole: stats[1].rows,
      totalProjects: parseInt(stats[2].rows[0].count),
      projectsByStatus: stats[3].rows,
      totalTransactions: parseInt(stats[4].rows[0].count),
      totalVolume: parseFloat(stats[5].rows[0].total),
      activeContracts: parseInt(stats[6].rows[0].count),
      pendingApplications: parseInt(stats[7].rows[0].count),
      recentUsers: stats[8].rows,
      recentProjects: stats[9].rows
    }
  });
}));

// Get all users
router.get('/users', asyncHandler(async (req: AuthRequest, res) => {
  const { role, status, search, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let query = `
    SELECT 
      u.id, u.email, u.role, u.status, u.email_verified, u.created_at,
      p.display_name, p.avatar_url, p.rating, p.is_verified,
      w.balance, w.escrow_balance
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN wallets w ON u.id = w.user_id
    WHERE 1=1
  `;

  const params: any[] = [];
  let paramIndex = 1;

  if (role) {
    query += ` AND u.role = $${paramIndex}`;
    params.push(role);
    paramIndex++;
  }

  if (status) {
    query += ` AND u.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (search) {
    query += ` AND (u.email ILIKE $${paramIndex} OR p.display_name ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(Number(limit), offset);

  const result = await db.query(query, params);

  // Get total count
  let countQuery = 'SELECT COUNT(*) FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE 1=1';
  const countParams: any[] = [];

  if (role) {
    countQuery += ' AND u.role = $1';
    countParams.push(role);
  }

  if (status) {
    countQuery += ' AND u.status = $2';
    countParams.push(status);
  }

  const countResult = await db.query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].count);

  res.json({
    users: result.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit))
    }
  });
}));

// Update user status
router.patch('/users/:id/status', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!['active', 'suspended', 'banned'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, id]
    );

    // Log admin action
    await client.query(
      `INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user!.userId, 'update_user_status', 'user', id, reason]
    );

    await client.query('COMMIT');

    res.json({ message: 'User status updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Get all projects
router.get('/projects', asyncHandler(async (req: AuthRequest, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let query = `
    SELECT 
      p.*,
      pr.display_name as client_name,
      pr.avatar_url as client_avatar,
      COUNT(a.id) as application_count
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

  query += ` GROUP BY p.id, pr.display_name, pr.avatar_url ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(Number(limit), offset);

  const result = await db.query(query, params);

  res.json({
    projects: result.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit)
    }
  });
}));

// Approve/reject project
router.patch('/projects/:id/status', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!['open', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  await db.query(
    'UPDATE projects SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [status, id]
  );

  res.json({ message: 'Project status updated successfully' });
}));

// Get all transactions
router.get('/transactions', asyncHandler(async (req: AuthRequest, res) => {
  const { type, status, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let query = `
    SELECT 
      t.*,
      p.display_name as user_name,
      pr.title as project_title
    FROM transactions t
    LEFT JOIN profiles p ON t.user_id = p.user_id
    LEFT JOIN projects pr ON t.project_id = pr.id
    WHERE 1=1
  `;

  const params: any[] = [];
  let paramIndex = 1;

  if (type) {
    query += ` AND t.type = $${paramIndex}`;
    params.push(type);
    paramIndex++;
  }

  if (status) {
    query += ` AND t.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(Number(limit), offset);

  const result = await db.query(query, params);

  res.json({
    transactions: result.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit)
    }
  });
}));

// Get disputes
router.get('/disputes', asyncHandler(async (req: AuthRequest, res) => {
  const { status } = req.query;

  let query = `
    SELECT 
      d.*,
      p.title as project_title,
      ra.display_name as raised_by_name,
      ag.display_name as against_name
    FROM disputes d
    LEFT JOIN contracts c ON d.contract_id = c.id
    LEFT JOIN projects p ON c.project_id = p.id
    LEFT JOIN profiles ra ON d.raised_by = ra.user_id
    LEFT JOIN profiles ag ON d.against_user = ag.user_id
    WHERE 1=1
  `;

  const params: any[] = [];

  if (status) {
    query += ` AND d.status = $1`;
    params.push(status);
  }

  query += ` ORDER BY d.created_at DESC`;

  const result = await db.query(query, params);

  res.json({ disputes: result.rows });
}));

// Resolve dispute
router.post('/disputes/:id/resolve', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { resolution, action } = req.body;

  await db.query(
    `UPDATE disputes 
     SET status = 'resolved', resolution = $1, resolved_by = $2, resolved_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [resolution, req.user!.userId, id]
  );

  res.json({ message: 'Dispute resolved successfully' });
}));

// Get platform settings
router.get('/settings', asyncHandler(async (req: AuthRequest, res) => {
  const result = await db.query('SELECT * FROM platform_settings');

  res.json({ settings: result.rows });
}));

// Update platform setting
router.put('/settings/:key', asyncHandler(async (req: AuthRequest, res) => {
  const { key } = req.params;
  const { value, description } = req.body;

  await db.query(
    `INSERT INTO platform_settings (key, value, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (key) 
     DO UPDATE SET value = $2, description = COALESCE($3, platform_settings.description), updated_at = CURRENT_TIMESTAMP`,
    [key, value, description]
  );

  res.json({ message: 'Setting updated successfully' });
}));

// Get admin action logs
router.get('/logs', asyncHandler(async (req: AuthRequest, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const result = await db.query(
    `SELECT 
      a.*,
      p.display_name as admin_name
     FROM admin_actions a
     LEFT JOIN profiles p ON a.admin_id = p.user_id
     ORDER BY a.created_at DESC
     LIMIT $1 OFFSET $2`,
    [Number(limit), offset]
  );

  res.json({ logs: result.rows });
}));

export default router;
