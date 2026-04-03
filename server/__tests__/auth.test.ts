import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from './testApp';
import { db } from '../index';
import { makeToken } from './helpers';

jest.mock('../index.ts');
jest.mock('bcryptjs');

const mockQuery = db.query as jest.Mock;
const mockConnect = db.connect as jest.Mock;
const mockBcryptHash = bcrypt.hash as jest.Mock;
const mockBcryptCompare = bcrypt.compare as jest.Mock;

const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();

beforeEach(() => {
  mockConnect.mockResolvedValue({
    query: mockClientQuery,
    release: mockClientRelease
  });
  mockBcryptHash.mockResolvedValue('hashed-password');
  mockBcryptCompare.mockResolvedValue(true);
});

// ── POST /api/auth/register ────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('returns 201 with token on valid registration', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // email not exists
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'new-id', email: 'new@example.com', role: 'freelancer' }] }) // insert user
      .mockResolvedValueOnce({ rows: [] }) // insert profile
      .mockResolvedValueOnce({ rows: [] }) // insert wallet
      .mockResolvedValueOnce({ rows: [] }) // insert notification
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', password: 'password123', role: 'freelancer', displayName: 'Test User' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('new@example.com');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Missing required fields');
  });

  it('returns 400 for invalid role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123', role: 'superuser', displayName: 'Test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid role/);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'short', role: 'freelancer', displayName: 'Test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 characters/);
  });

  it('returns 409 when email already exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'existing@example.com', password: 'password123', role: 'client', displayName: 'Existing' });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error', 'Email already registered');
  });
});

// ── POST /api/auth/login ───────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns 200 with token on valid credentials', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'user-id', email: 'user@example.com', password_hash: 'hashed',
          role: 'freelancer', status: 'active', email_verified: true,
          display_name: 'Test User', avatar_url: null, is_verified: false,
          rating: 4.5, headline: 'Developer'
        }]
      })
      .mockResolvedValueOnce({ rows: [] }); // update last login

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('user@example.com');
  });

  it('returns 400 when email or password missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Email and password are required');
  });

  it('returns 401 when user not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'notfound@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid email or password');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'user-id', email: 'user@example.com', password_hash: 'hash', role: 'freelancer', status: 'suspended' }]
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'password123' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/suspended/);
  });

  it('returns 401 when password is incorrect', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'user-id', email: 'user@example.com', password_hash: 'hash', role: 'freelancer', status: 'active' }]
    });
    mockBcryptCompare.mockResolvedValueOnce(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid email or password');
  });
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns 200 with user data for valid token', async () => {
    const token = makeToken({ userId: 'user-id', email: 'user@example.com', role: 'freelancer' });

    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'user-id', email: 'user@example.com', role: 'freelancer',
          email_verified: true, display_name: 'Test', avatar_url: null,
          headline: null, bio: null, location: null, hourly_rate: null,
          is_verified: false, rating: 0, review_count: 0, total_earnings: 0,
          total_spent: 0, availability: 'available', balance: 100, escrow_balance: 0
        }]
      })
      .mockResolvedValueOnce({ rows: [] }); // skills

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('id', 'user-id');
    expect(res.body.user).toHaveProperty('wallet');
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token-xyz');
    expect(res.status).toBe(401);
  });
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  it('returns 200 success message whether email exists or not', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'user-id' }] });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password reset link/);
  });

  it('returns same message when email does not exist (prevent enumeration)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password reset link/);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Email is required');
  });
});
