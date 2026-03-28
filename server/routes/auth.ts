import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../index';
import { generateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const SALT_ROUNDS = 12;

// Register
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, role, displayName, headline, location } = req.body;

  // Validation
  if (!email || !password || !role || !displayName) {
    return res.status(400).json({
      error: 'Missing required fields',
      fields: ['email', 'password', 'role', 'displayName']
    });
  }

  if (!['freelancer', 'client'].includes(role)) {
    return res.status(400).json({
      error: 'Invalid role. Must be "freelancer" or "client"'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long'
    });
  }

  // Check if email exists
  const existingUser = await db.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (existingUser.rows.length > 0) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user and profile in transaction
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');

    // Create user
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, email, role, created_at`,
      [email.toLowerCase(), passwordHash, role]
    );

    const user = userResult.rows[0];

    // Create profile
    await client.query(
      `INSERT INTO profiles (user_id, display_name, headline, location)
       VALUES ($1, $2, $3, $4)`,
      [user.id, displayName, headline || null, location || null]
    );

    // Create wallet
    await client.query(
      `INSERT INTO wallets (user_id, balance, currency)
       VALUES ($1, 0, 'USD')`,
      [user.id]
    );

    // Create welcome notification
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)`,
      [
        user.id,
        'welcome',
        'Welcome to SkillBridge!',
        'Your account has been created successfully. Start exploring projects or post your first job!'
      ]
    );

    await client.query('COMMIT');

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName
      },
      token
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required'
    });
  }

  // Get user with profile
  const result = await db.query(
    `SELECT u.id, u.email, u.password_hash, u.role, u.status, u.email_verified,
            p.display_name, p.avatar_url, p.is_verified, p.rating, p.headline
     FROM users u
     LEFT JOIN profiles p ON u.id = p.user_id
     WHERE u.email = $1`,
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = result.rows[0];

  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Account is suspended or banned' });
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Generate token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role
  });

  // Update last login (optional tracking)
  await db.query(
    'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [user.id]
  );

  res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      isVerified: user.is_verified,
      rating: user.rating,
      headline: user.headline,
      emailVerified: user.email_verified
    },
    token
  });
}));

// Get current user
router.get('/me', asyncHandler(async (req: any, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const jwt = require('jsonwebtoken');
  const { JWT_SECRET } = require('../middleware/auth');
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const result = await db.query(
      `SELECT u.id, u.email, u.role, u.email_verified,
              p.display_name, p.avatar_url, p.headline, p.bio, p.location,
              p.hourly_rate, p.is_verified, p.rating, p.review_count,
              p.total_earnings, p.total_spent, p.availability,
              w.balance, w.escrow_balance
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       LEFT JOIN wallets w ON u.id = w.user_id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Get user skills
    const skillsResult = await db.query(
      `SELECT s.id, s.name, s.category, us.proficiency_level
       FROM user_skills us
       JOIN skills s ON us.skill_id = s.id
       WHERE us.user_id = $1`,
      [user.id]
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        headline: user.headline,
        bio: user.bio,
        location: user.location,
        hourlyRate: user.hourly_rate,
        isVerified: user.is_verified,
        rating: user.rating,
        reviewCount: user.review_count,
        totalEarnings: user.total_earnings,
        totalSpent: user.total_spent,
        availability: user.availability,
        emailVerified: user.email_verified,
        wallet: {
          balance: user.balance,
          escrowBalance: user.escrow_balance
        },
        skills: skillsResult.rows
      }
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}));

// Request password reset
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Check if user exists
  const result = await db.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  // Always return success to prevent email enumeration
  if (result.rows.length === 0) {
    return res.json({
      message: 'If an account exists with this email, you will receive a password reset link'
    });
  }

  // TODO: Send actual reset email
  // For now, just return success message

  res.json({
    message: 'If an account exists with this email, you will receive a password reset link'
  });
}));

// Change password
router.post('/change-password', asyncHandler(async (req: any, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      error: 'Current password and new password are required'
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      error: 'New password must be at least 8 characters long'
    });
  }

  const jwt = require('jsonwebtoken');
  const { JWT_SECRET } = require('../middleware/auth');
  
  const decoded = jwt.verify(token, JWT_SECRET);

  // Get user
  const result = await db.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [decoded.userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = result.rows[0];

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password_hash);

  if (!isValid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Hash new password
  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Update password
  await db.query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [newHash, decoded.userId]
  );

  res.json({ message: 'Password changed successfully' });
}));

export default router;
