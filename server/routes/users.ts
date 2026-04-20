import { Router } from 'express';
import { db } from '../index.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';

const router = Router();

// Get current user profile (no ID required)
router.get('/profile', asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!.userId;

  const query = `
    SELECT 
      u.id, u.email, u.role, u.created_at,
      p.*,
      (SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'category', s.category, 'proficiency', us.proficiency_level))
       FROM user_skills us
       JOIN skills s ON us.skill_id = s.id
       WHERE us.user_id = u.id) as skills,
      (SELECT json_agg(pi.*)
       FROM (SELECT * FROM portfolio_items WHERE user_id = u.id ORDER BY created_at DESC LIMIT 6) as pi) as portfolio,
      (SELECT COALESCE(json_agg(json_build_object('id', r.id, 'rating', r.rating, 'content', r.content, 'created_at', r.created_at,
        'reviewer_name', r.display_name, 'reviewer_avatar', r.avatar_url)), '[]'::json)
       FROM (
         SELECT r.id, r.rating, r.content, r.created_at, rp.display_name, rp.avatar_url
         FROM reviews r
         JOIN profiles rp ON r.reviewer_id = rp.user_id
         WHERE r.reviewee_id = u.id
         ORDER BY r.created_at DESC
         LIMIT 5
       ) as r
      ) as reviews
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    WHERE u.id = $1 AND u.status = 'active'
  `;

  const result = await db.query(query, [userId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const profile = result.rows[0];
  res.json({ profile });
}));

// Get user profile by ID
router.get('/profile/:id', asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.params.id;

  const query = `
    SELECT 
      u.id, u.email, u.role, u.created_at,
      p.*,
      (SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'category', s.category, 'proficiency', us.proficiency_level))
       FROM user_skills us
       JOIN skills s ON us.skill_id = s.id
       WHERE us.user_id = u.id) as skills,
      (SELECT json_agg(pi.*)
       FROM (SELECT * FROM portfolio_items WHERE user_id = u.id ORDER BY created_at DESC LIMIT 6) as pi) as portfolio,
      (SELECT COALESCE(json_agg(json_build_object('id', r.id, 'rating', r.rating, 'content', r.content, 'created_at', r.created_at,
        'reviewer_name', r.display_name, 'reviewer_avatar', r.avatar_url)), '[]'::json)
       FROM (
         SELECT r.id, r.rating, r.content, r.created_at, rp.display_name, rp.avatar_url
         FROM reviews r
         JOIN profiles rp ON r.reviewer_id = rp.user_id
         WHERE r.reviewee_id = u.id
         ORDER BY r.created_at DESC
         LIMIT 5
       ) as r
      ) as reviews
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

// Complete profile (with CV and social links)
router.post('/profile/complete', asyncHandler(async (req: AuthRequest, res) => {
  const {
    cvUrl,
    cvDataUrl,
    cvFileType,
    websiteUrl,
    socialLinks,
    linkedinUrl,
    githubUrl,
    upworkUrl,
    fiverrUrl,
    headline,
    bio,
    location
  } = req.body;

  const normalizeHttpUrl = (value?: unknown): string | null => {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
      const parsed = new URL(withProtocol);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  };

  const allowedCvMime = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]);

  let normalizedCvDataUrl: string | null = null;
  if (typeof cvDataUrl === 'string' && cvDataUrl.trim()) {
    const isSupportedDataUrl = /^data:(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document);base64,/i.test(cvDataUrl);
    if (!isSupportedDataUrl) {
      return res.status(400).json({ error: 'Unsupported CV file type. Use PDF, DOC, or DOCX.' });
    }
    if (cvDataUrl.length > 7 * 1024 * 1024) {
      return res.status(400).json({ error: 'CV file is too large. Maximum size is 5MB.' });
    }
    normalizedCvDataUrl = cvDataUrl;
  }

  if (typeof cvFileType === 'string' && cvFileType && !allowedCvMime.has(cvFileType)) {
    return res.status(400).json({ error: 'Unsupported CV file type. Use PDF, DOC, or DOCX.' });
  }

  const normalizedSocialLinks = Array.isArray(socialLinks)
    ? socialLinks
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const rawPlatform = typeof item.platform === 'string' ? item.platform.trim().toLowerCase() : 'other';
          const platform = rawPlatform || 'other';
          const url = normalizeHttpUrl(item.url);

          if (!url) {
            return null;
          }

          return { platform, url };
        })
        .filter((item): item is { platform: string; url: string } => Boolean(item))
    : [];

  const firstSocial = (platform: string) => normalizedSocialLinks.find((item) => item.platform === platform)?.url || null;

  const storedCv = normalizedCvDataUrl || normalizeHttpUrl(cvUrl);

  const columnsResult = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'profiles'`
  );
  const existingColumns = new Set(columnsResult.rows.map((r: { column_name: string }) => r.column_name));

  const updateMap: Array<[string, any]> = [
    ['cv_url', storedCv || null],
    ['linkedin_url', firstSocial('linkedin') || normalizeHttpUrl(linkedinUrl)],
    ['github_url', firstSocial('github') || normalizeHttpUrl(githubUrl)],
    ['upwork_url', firstSocial('upwork') || normalizeHttpUrl(upworkUrl)],
    ['fiverr_url', firstSocial('fiverr') || normalizeHttpUrl(fiverrUrl)],
    ['website_url', firstSocial('portfolio') || firstSocial('other') || normalizeHttpUrl(websiteUrl)],
    ['social_links', normalizedSocialLinks.length > 0 ? normalizedSocialLinks : null],
    ['headline', headline || null],
    ['bio', bio || null],
    ['location', location || null]
  ];

  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 2;

  for (const [column, value] of updateMap) {
    if (!existingColumns.has(column) || value === null) {
      continue;
    }
    setClauses.push(`${column} = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }

  if (existingColumns.has('profile_completed')) {
    setClauses.push('profile_completed = TRUE');
  }

  setClauses.push('updated_at = CURRENT_TIMESTAMP');

  const result = await db.query(
    `UPDATE profiles
     SET ${setClauses.join(', ')}
     WHERE user_id = $1
     RETURNING *`,
    [req.user!.userId, ...values]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  res.json({
    message: 'Profile completed successfully',
    profile: result.rows[0]
  });
}));

// Get profile completion status
router.get('/profile/status/completion', asyncHandler(async (req: AuthRequest, res) => {
  const columnsResult = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'profiles'`
  );
  const hasProfileCompleted = columnsResult.rows.some(
    (r: { column_name: string }) => r.column_name === 'profile_completed'
  );

  const result = hasProfileCompleted
    ? await db.query(`SELECT profile_completed FROM profiles WHERE user_id = $1`, [req.user!.userId])
    : await db.query(`SELECT headline, bio, location FROM profiles WHERE user_id = $1`, [req.user!.userId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const row = result.rows[0];
  const profileCompleted = hasProfileCompleted
    ? Boolean(row.profile_completed)
    : Boolean(row.headline || row.bio || row.location);

  res.json({ profileCompleted });
}));

export default router;
