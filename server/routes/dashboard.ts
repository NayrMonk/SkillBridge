import { Router } from 'express';
import { db } from '../index.ts';
import { AuthRequest } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';

const router = Router();

// Get freelancer dashboard
router.get('/freelancer', asyncHandler(async (req: AuthRequest, res) => {
  if (req.user!.role !== 'freelancer' && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const userId = req.user!.userId;

  const [
    earnings,
    activeJobs,
    appliedJobs,
    unreadMessages,
    recentApplications,
    upcomingDeadlines,
    skillsProgress,
    weeklyEarnings
  ] = await Promise.all([
    // Total earnings
    db.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
       WHERE user_id = $1 AND type = 'escrow_release' AND status = 'completed'`,
      [userId]
    ),
    // Active jobs
    db.query(
      `SELECT COUNT(*) as count FROM contracts 
       WHERE freelancer_id = $1 AND status = 'active'`,
      [userId]
    ),
    // Applied jobs
    db.query(
      `SELECT COUNT(*) as count FROM applications 
       WHERE freelancer_id = $1 AND status = 'pending'`,
      [userId]
    ),
    // Unread messages
    db.query(
      `SELECT COUNT(*) as count FROM messages 
       WHERE recipient_id = $1 AND is_read = false`,
      [userId]
    ),
    // Recent applications
    db.query(
      `SELECT 
        a.*,
        p.title as project_title,
        p.category as project_category,
        p.budget_min,
        p.budget_max
       FROM applications a
       JOIN projects p ON a.project_id = p.id
       WHERE a.freelancer_id = $1
       ORDER BY a.created_at DESC
       LIMIT 5`,
      [userId]
    ),
    // Upcoming deadlines
    db.query(
      `SELECT 
        c.*,
        p.title as project_title,
        p.deadline
       FROM contracts c
       JOIN projects p ON c.project_id = p.id
       WHERE c.freelancer_id = $1 AND c.status = 'active'
       AND p.deadline IS NOT NULL AND p.deadline > CURRENT_TIMESTAMP
       ORDER BY p.deadline
       LIMIT 5`,
      [userId]
    ),
    // Skills progress
    db.query(
      `SELECT 
        s.name,
        s.category,
        us.proficiency_level
       FROM user_skills us
       JOIN skills s ON us.skill_id = s.id
       WHERE us.user_id = $1
       ORDER BY us.proficiency_level DESC
       LIMIT 5`,
      [userId]
    ),
    // Weekly earnings (last 4 weeks)
    db.query(
      `SELECT 
        DATE_TRUNC('week', completed_at) as week,
        SUM(amount) as earnings
       FROM transactions
       WHERE user_id = $1 AND type = 'escrow_release' AND status = 'completed'
       AND completed_at > CURRENT_TIMESTAMP - INTERVAL '4 weeks'
       GROUP BY DATE_TRUNC('week', completed_at)
       ORDER BY week`,
      [userId]
    )
  ]);

  res.json({
    dashboard: {
      stats: {
        totalEarnings: parseFloat(earnings.rows[0]?.total || '0'),
        activeJobs: parseInt(activeJobs.rows[0]?.count || '0'),
        pendingApplications: parseInt(appliedJobs.rows[0]?.count || '0'),
        unreadMessages: parseInt(unreadMessages.rows[0]?.count || '0')
      },
      recentApplications: recentApplications.rows,
      upcomingDeadlines: upcomingDeadlines.rows,
      skillsProgress: skillsProgress.rows,
      weeklyEarnings: weeklyEarnings.rows
    }
  });
}));

// Get client dashboard
router.get('/client', asyncHandler(async (req: AuthRequest, res) => {
  if (req.user!.role !== 'client' && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const userId = req.user!.userId;

  const [
    totalSpent,
    activeProjects,
    totalProjects,
    unreadMessages,
    recentProjects,
    pendingApplications,
    activeContracts,
    monthlySpending
  ] = await Promise.all([
    // Total spent
    db.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
       WHERE user_id = $1 AND type IN ('escrow_deposit', 'promotion_payment') AND status = 'completed'`,
      [userId]
    ),
    // Active projects
    db.query(
      `SELECT COUNT(*) as count FROM projects 
       WHERE client_id = $1 AND status = 'in_progress'`,
      [userId]
    ),
    // Total projects
    db.query(
      `SELECT COUNT(*) as count FROM projects 
       WHERE client_id = $1`,
      [userId]
    ),
    // Unread messages
    db.query(
      `SELECT COUNT(*) as count FROM messages 
       WHERE recipient_id = $1 AND is_read = false`,
      [userId]
    ),
    // Recent projects
    db.query(
      `SELECT 
        p.*,
        (SELECT COUNT(*) FROM applications WHERE project_id = p.id) as application_count
       FROM projects p
       WHERE p.client_id = $1
       ORDER BY p.created_at DESC
       LIMIT 5`,
      [userId]
    ),
    // Pending applications
    db.query(
      `SELECT 
        a.*,
        p.title as project_title,
        pr.display_name as freelancer_name,
        pr.avatar_url as freelancer_avatar
       FROM applications a
       JOIN projects p ON a.project_id = p.id
       JOIN profiles pr ON a.freelancer_id = pr.user_id
       WHERE p.client_id = $1 AND a.status = 'pending'
       ORDER BY a.created_at DESC
       LIMIT 5`,
      [userId]
    ),
    // Active contracts
    db.query(
      `SELECT 
        c.*,
        p.title as project_title,
        pr.display_name as freelancer_name,
        pr.avatar_url as freelancer_avatar
       FROM contracts c
       JOIN projects p ON c.project_id = p.id
       JOIN profiles pr ON c.freelancer_id = pr.user_id
       WHERE c.client_id = $1 AND c.status = 'active'
       LIMIT 5`,
      [userId]
    ),
    // Monthly spending (last 6 months)
    db.query(
      `SELECT 
        DATE_TRUNC('month', completed_at) as month,
        SUM(amount) as spending
       FROM transactions
       WHERE user_id = $1 AND type IN ('escrow_deposit', 'promotion_payment') AND status = 'completed'
       AND completed_at > CURRENT_TIMESTAMP - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', completed_at)
       ORDER BY month`,
      [userId]
    )
  ]);

  res.json({
    dashboard: {
      stats: {
        totalSpent: parseFloat(totalSpent.rows[0]?.total || '0'),
        activeProjects: parseInt(activeProjects.rows[0]?.count || '0'),
        totalProjects: parseInt(totalProjects.rows[0]?.count || '0'),
        unreadMessages: parseInt(unreadMessages.rows[0]?.count || '0')
      },
      recentProjects: recentProjects.rows,
      pendingApplications: pendingApplications.rows,
      activeContracts: activeContracts.rows,
      monthlySpending: monthlySpending.rows
    }
  });
}));

// Get notifications
router.get('/notifications', asyncHandler(async (req: AuthRequest, res) => {
  const { unreadOnly, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let query = `
    SELECT * FROM notifications
    WHERE user_id = $1
  `;

  const params: any[] = [req.user!.userId];
  let paramIndex = 2;

  if (unreadOnly === 'true') {
    query += ` AND is_read = false`;
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(Number(limit), offset);

  const result = await db.query(query, params);

  // Get unread count
  const unreadResult = await db.query(
    'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
    [req.user!.userId]
  );

  res.json({
    notifications: result.rows,
    unreadCount: parseInt(unreadResult.rows[0].count)
  });
}));

// Mark notification as read
router.patch('/notifications/:id/read', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  await db.query(
    `UPDATE notifications 
     SET is_read = true, read_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2`,
    [id, req.user!.userId]
  );

  res.json({ message: 'Notification marked as read' });
}));

// Mark all notifications as read
router.post('/notifications/read-all', asyncHandler(async (req: AuthRequest, res) => {
  await db.query(
    `UPDATE notifications 
     SET is_read = true, read_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND is_read = false`,
    [req.user!.userId]
  );

  res.json({ message: 'All notifications marked as read' });
}));

export default router;
