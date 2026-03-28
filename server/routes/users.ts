import { Router } from 'express';
import { db } from '../index';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Get user profile
router.get('/profile/:id', asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.params.id || req.user!.userId;

  const query = `
    SELECT 
      u.id, u.email, u.role, u.created_at,
      p.*,
      (SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'category', s.category, 'proficiency', us.proficiency_level))
       FROM user_skills us
       JOIN skills s ON us.skill_id = s.id
       WHERE us.user_id = u.id) as skills,
      (SELECT json_agg(pi.*)
       FROM portfolio_items pi
       WHERE pi.user_id = u.id
       LIMIT 6) as portfolio,
      (SELECT json_agg(json_build_object('id', r.id, 'rating', r.rating, 'content', r.content, 'created_at', r.created_at,
        'reviewer_name', rp.display_name, 'reviewer_avatar', rp.avatar_url))
       FROM reviews r
       JOIN profiles rp ON r.reviewer_id = rp.user_id
       WHERE r.reviewee_id = u.id
       LIMIT 5) as reviews
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    WHERE u.id = $1 AND u.status = 'active'
  `;

  const result = await db.query(query, [userId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const profile = result.rows[0];

  // Don't expose sensitive info for other users
  if (userId !== req.user!.userId) {
    delete profile.email;
  }

  res.json({ profile });
}));

// Update my profile
router.put('/profile', asyncHandler(async (req: AuthRequest, res) => {
  const {
    displayName,
    headline,
    bio,
    location,
    timezone,
    websiteUrl,
    linkedinUrl,
    githubUrl,
    hourlyRate,
    availability,
    avatarUrl
  } = req.body;

  const allowedUpdates = {
    display_name: displayName,
    headline,
    bio,
    location,
    timezone,
    website_url: websiteUrl,
    linkedin_url: linkedinUrl,
    github_url: githubUrl,
    hourly_rate: hourlyRate,
    availability,
    avatar_url: avatarUrl
  };

  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(allowedUpdates)) {
    if (value !== undefined) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  values.push(req.user!.userId);

  const query = `
    UPDATE profiles 
    SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $${paramIndex}
    RETURNING *
  `;

  const result = await db.query(query, values);

  if (result.rows.length === 0) {
    // Create profile if doesn't exist
    const newProfile = await db.query(
      `INSERT INTO profiles (user_id, display_name)
       VALUES ($1, $2)
       RETURNING *`,
      [req.user!.userId, displayName || 'User']
    );
    return res.json({ profile: newProfile.rows[0] });
  }

  res.json({
    message: 'Profile updated successfully',
    profile: result.rows[0]
  });
}));

// Add skill to profile
router.post('/skills', asyncHandler(async (req: AuthRequest, res) => {
  const { skillId, proficiencyLevel } = req.body;

  if (!skillId) {
    return res.status(400).json({ error: 'Skill ID is required' });
  }

  // Check if skill exists
  const skillResult = await db.query('SELECT id FROM skills WHERE id = $1', [skillId]);

  if (skillResult.rows.length === 0) {
    return res.status(404).json({ error: 'Skill not found' });
  }

  await db.query(
    `INSERT INTO user_skills (user_id, skill_id, proficiency_level)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, skill_id) 
     DO UPDATE SET proficiency_level = $3`,
    [req.user!.userId, skillId, proficiencyLevel || 3]
  );

  res.json({ message: 'Skill added successfully' });
}));

// Remove skill from profile
router.delete('/skills/:skillId', asyncHandler(async (req: AuthRequest, res) => {
  const { skillId } = req.params;

  await db.query(
    'DELETE FROM user_skills WHERE user_id = $1 AND skill_id = $2',
    [req.user!.userId, skillId]
  );

  res.json({ message: 'Skill removed successfully' });
}));

// Add portfolio item
router.post('/portfolio', asyncHandler(async (req: AuthRequest, res) => {
  const { title, description, imageUrls, projectUrl, skills } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const result = await db.query(
    `INSERT INTO portfolio_items (user_id, title, description, image_urls, project_url, skills)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      req.user!.userId,
      title,
      description,
      imageUrls || [],
      projectUrl,
      skills || []
    ]
  );

  res.status(201).json({
    message: 'Portfolio item added successfully',
    item: result.rows[0]
  });
}));

// Delete portfolio item
router.delete('/portfolio/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const result = await db.query(
    'DELETE FROM portfolio_items WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, req.user!.userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Portfolio item not found' });
  }

  res.json({ message: 'Portfolio item deleted successfully' });
}));

// Search freelancers
router.get('/search', asyncHandler(async (req: AuthRequest, res) => {
  const {
    skills,
    minRating,
    maxHourlyRate,
    availability,
    search,
    page = 1,
    limit = 20
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);

  let query = `
    SELECT 
      u.id,
      p.display_name,
      p.avatar_url,
      p.headline,
      p.location,
      p.hourly_rate,
      p.rating,
      p.review_count,
      p.availability,
      p.is_verified,
      (SELECT json_agg(json_build_object('id', s.id, 'name', s.name))
       FROM user_skills us
       JOIN skills s ON us.skill_id = s.id
       WHERE us.user_id = u.id
       LIMIT 5) as skills
    FROM users u
    JOIN profiles p ON u.id = p.user_id
    WHERE u.role = 'freelancer' AND u.status = 'active'
  `;

  const params: any[] = [];
  let paramIndex = 1;

  if (skills) {
    query += ` AND EXISTS (
      SELECT 1 FROM user_skills us 
      WHERE us.user_id = u.id AND us.skill_id = ANY($${paramIndex})
    )`;
    params.push(Array.isArray(skills) ? skills : [skills]);
    paramIndex++;
  }

  if (minRating) {
    query += ` AND p.rating >= $${paramIndex}`;
    params.push(minRating);
    paramIndex++;
  }

  if (maxHourlyRate) {
    query += ` AND (p.hourly_rate IS NULL OR p.hourly_rate <= $${paramIndex})`;
    params.push(maxHourlyRate);
    paramIndex++;
  }

  if (availability) {
    query += ` AND p.availability = $${paramIndex}`;
    params.push(availability);
    paramIndex++;
  }

  if (search) {
    query += ` AND (p.display_name ILIKE $${paramIndex} OR p.headline ILIKE $${paramIndex} OR p.bio ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  query += ` ORDER BY p.rating DESC, p.review_count DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(Number(limit), offset);

  const result = await db.query(query, params);

  res.json({
    freelancers: result.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit)
    }
  });
}));

// Get all skills
router.get('/skills/list', asyncHandler(async (req, res) => {
  const { category } = req.query;

  let query = 'SELECT * FROM skills';
  const params: any[] = [];

  if (category) {
    query += ' WHERE category = $1';
    params.push(category);
  }

  query += ' ORDER BY category, name';

  const result = await db.query(query, params);

  res.json({ skills: result.rows });
}));

export default router;
