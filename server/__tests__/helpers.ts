import jwt from 'jsonwebtoken';

const JWT_SECRET = 'your-secret-key-change-in-production';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export const makeToken = (payload: TokenPayload = {
  userId: 'user-test-id',
  email: 'test@example.com',
  role: 'freelancer'
}): string => jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

export const FREELANCER_TOKEN_PAYLOAD: TokenPayload = {
  userId: 'freelancer-user-id',
  email: 'freelancer@example.com',
  role: 'freelancer'
};

export const CLIENT_TOKEN_PAYLOAD: TokenPayload = {
  userId: 'client-user-id',
  email: 'client@example.com',
  role: 'client'
};

export const ADMIN_TOKEN_PAYLOAD: TokenPayload = {
  userId: 'admin-user-id',
  email: 'admin@example.com',
  role: 'admin'
};

export const freelancerToken = makeToken(FREELANCER_TOKEN_PAYLOAD);
export const clientToken = makeToken(CLIENT_TOKEN_PAYLOAD);
export const adminToken = makeToken(ADMIN_TOKEN_PAYLOAD);

// Standard active user row returned by auth middleware db.query
export const activeFreelancerRow = {
  id: 'freelancer-user-id',
  email: 'freelancer@example.com',
  role: 'freelancer',
  status: 'active'
};

export const activeClientRow = {
  id: 'client-user-id',
  email: 'client@example.com',
  role: 'client',
  status: 'active'
};

export const activeAdminRow = {
  id: 'admin-user-id',
  email: 'admin@example.com',
  role: 'admin',
  status: 'active'
};
