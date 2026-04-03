/// <reference types="jest" />
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from './testApp';
import { db } from '../index';
import {
  freelancerToken, clientToken, adminToken,
  activeFreelancerRow, activeClientRow, activeAdminRow,
  FREELANCER_TOKEN_PAYLOAD, CLIENT_TOKEN_PAYLOAD
} from './helpers';

jest.mock('../index.ts');

// Stripe mock — factory must not reference outer variables (hoisting issue)
jest.mock('stripe', () => {
  const mockCreate = jest.fn();
  const mockRetrieve = jest.fn();
  const MockStripe = jest.fn().mockImplementation(() => ({
    paymentIntents: { create: mockCreate, retrieve: mockRetrieve }
  }));
  (MockStripe as any).__mockCreate = mockCreate;
  (MockStripe as any).__mockRetrieve = mockRetrieve;
  return MockStripe;
});

import Stripe from 'stripe';

const StripeConstructor = Stripe as unknown as jest.Mock & {
  __mockCreate: jest.Mock;
  __mockRetrieve: jest.Mock;
};

const JWT_SECRET = 'your-secret-key-change-in-production';

const mockQuery = db.query as jest.Mock;
const mockConnect = db.connect as jest.Mock;
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });

  StripeConstructor.__mockCreate.mockResolvedValue({
    client_secret: 'pi_test_secret',
    id: 'pi_test_id',
    amount: 5000,
    status: 'requires_payment_method'
  });

  StripeConstructor.__mockRetrieve.mockResolvedValue({
    id: 'pi_test_id',
    amount: 5000,
    status: 'succeeded'
  });
});

const authFreelancer = () => mockQuery.mockResolvedValueOnce({ rows: [activeFreelancerRow] });
const authClient = () => mockQuery.mockResolvedValueOnce({ rows: [activeClientRow] });
const authAdmin = () => mockQuery.mockResolvedValueOnce({ rows: [activeAdminRow] });

const expiredFreelancerToken = jwt.sign(FREELANCER_TOKEN_PAYLOAD, JWT_SECRET, { expiresIn: '-1s' });
const expiredClientToken = jwt.sign(CLIENT_TOKEN_PAYLOAD, JWT_SECRET, { expiresIn: '-1s' });
const invalidToken = 'this.is.not.a.valid.jwt';

// ── GET /api/payments/wallet ───────────────────────────────────────────────

describe('GET /api/payments/wallet', () => {
  it('returns 200 with wallet data', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'wallet-id', balance: 100, escrow_balance: 0,
        total_deposited: 200, total_withdrawn: 100, currency: 'USD',
        recent_transactions: []
      }]
    });

    const res = await request(app)
      .get('/api/payments/wallet')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('wallet');
    expect(res.body.wallet).toHaveProperty('balance', 100);
    expect(res.body).toHaveProperty('recentTransactions');
  });

  it('creates wallet if it does not exist', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'new-wallet-id', balance: 0, currency: 'USD' }] });

    const res = await request(app)
      .get('/api/payments/wallet')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.wallet.balance).toBe(0);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/payments/wallet');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/payments/wallet')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .get('/api/payments/wallet')
      .set('Authorization', `Bearer ${expiredFreelancerToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/payments/wallet')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeFreelancerRow, status: 'suspended' }] });
    const res = await request(app)
      .get('/api/payments/wallet')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });

  it('returns correct wallet shape (escrowBalance, totalDeposited, totalWithdrawn, currency)', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'wallet-id', balance: 250, escrow_balance: 50,
        total_deposited: 400, total_withdrawn: 100, currency: 'USD',
        recent_transactions: [{ id: 'tx-1' }]
      }]
    });

    const res = await request(app)
      .get('/api/payments/wallet')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.wallet).toMatchObject({
      balance: 250,
      escrowBalance: 50,
      totalDeposited: 400,
      totalWithdrawn: 100,
      currency: 'USD'
    });
    expect(res.body.recentTransactions).toHaveLength(1);
  });

  it('returns empty recentTransactions array when recent_transactions is null', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'wallet-id', balance: 0, escrow_balance: 0,
        total_deposited: 0, total_withdrawn: 0, currency: 'USD',
        recent_transactions: null
      }]
    });

    const res = await request(app)
      .get('/api/payments/wallet')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.recentTransactions).toEqual([]);
  });

  it('returns 500 when wallet creation INSERT throws', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })             // wallet not found
      .mockRejectedValueOnce(new Error('INSERT failed')); // creation fails

    const res = await request(app)
      .get('/api/payments/wallet')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });

  it('returns 500 when DB throws during wallet fetch', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await request(app)
      .get('/api/payments/wallet')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });
});

// ── GET /api/payments/transactions ────────────────────────────────────────

describe('GET /api/payments/transactions', () => {
  it('returns 200 with transactions list', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'tx-1', type: 'deposit', amount: 100 }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/payments/transactions')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('transactions');
    expect(res.body.pagination).toHaveProperty('total', 1);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/payments/transactions');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/payments/transactions')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .get('/api/payments/transactions')
      .set('Authorization', `Bearer ${expiredFreelancerToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/payments/transactions')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeFreelancerRow, status: 'suspended' }] });
    const res = await request(app)
      .get('/api/payments/transactions')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });

  it('returns empty transactions array when none found', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const res = await request(app)
      .get('/api/payments/transactions')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
  });

  it('applies type filter when provided', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'tx-1', type: 'deposit', amount: 100 }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/payments/transactions?type=deposit')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    const txCall = mockQuery.mock.calls[1];
    expect(txCall[1]).toContain('deposit');
  });

  it('applies status filter when provided', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'tx-2', status: 'completed' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/payments/transactions?status=completed')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    const txCall = mockQuery.mock.calls[1];
    expect(txCall[1]).toContain('completed');
  });

  it('returns correct pagination metadata with custom page and limit', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '50' }] });

    const res = await request(app)
      .get('/api/payments/transactions?page=3&limit=5')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(3);
    expect(res.body.pagination.limit).toBe(5);
    expect(res.body.pagination.total).toBe(50);
  });

  it('calculates totalPages correctly', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '45' }] });

    const res = await request(app)
      .get('/api/payments/transactions?limit=10')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    // ceil(45 / 10) = 5
    expect(res.body.pagination.totalPages).toBe(5);
  });

  it('returns 500 when the count query throws', async () => {
    authFreelancer();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'tx-1' }] }) // main query succeeds
      .mockRejectedValueOnce(new Error('Count query failed'));

    const res = await request(app)
      .get('/api/payments/transactions')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });

  it('returns 500 when DB throws during transactions query', async () => {
    authFreelancer();
    mockQuery.mockRejectedValueOnce(new Error('Query failed'));

    const res = await request(app)
      .get('/api/payments/transactions')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(500);
  });
});

// ── POST /api/payments/deposit/intent ─────────────────────────────────────

describe('POST /api/payments/deposit/intent', () => {
  it('returns 200 with clientSecret for valid amount', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/payments/deposit/intent')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 50 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('clientSecret');
    expect(res.body).toHaveProperty('amount', 50);
  });

  it('returns 400 when amount is less than 10', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/payments/deposit/intent')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Minimum deposit/);
  });

  it('returns 400 when amount is missing', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/payments/deposit/intent')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Minimum deposit/);
  });

  it('returns 400 when amount is not a number', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/payments/deposit/intent')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 'fifty' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Minimum deposit/);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .post('/api/payments/deposit/intent')
      .send({ amount: 50 });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .post('/api/payments/deposit/intent')
      .set('Authorization', `Bearer ${invalidToken}`)
      .send({ amount: 50 });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .post('/api/payments/deposit/intent')
      .set('Authorization', `Bearer ${expiredFreelancerToken}`)
      .send({ amount: 50 });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/payments/deposit/intent')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 50 });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeFreelancerRow, status: 'suspended' }] });
    const res = await request(app)
      .post('/api/payments/deposit/intent')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 50 });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });

  it('accepts exactly the minimum amount of 10', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/payments/deposit/intent')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('clientSecret');
  });

  it('sends amount in cents (amount * 100) to Stripe', async () => {
    authFreelancer();

    await request(app)
      .post('/api/payments/deposit/intent')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 75 });

    expect(StripeConstructor.__mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 7500, currency: 'usd' })
    );
  });

  it('returns 500 when Stripe create throws', async () => {
    authFreelancer();
    StripeConstructor.__mockCreate.mockRejectedValueOnce(new Error('Stripe API error'));

    const res = await request(app)
      .post('/api/payments/deposit/intent')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 50 });

    expect(res.status).toBe(500);
  });
});

// ── POST /api/payments/deposit/confirm ────────────────────────────────────

describe('POST /api/payments/deposit/confirm', () => {
  it('returns 200 when deposit is confirmed', async () => {
    authFreelancer();

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // update wallet
      .mockResolvedValueOnce({ rows: [] }) // insert transaction
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/payments/deposit/confirm')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ paymentIntentId: 'pi_test_id' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Deposit successful');
    expect(res.body).toHaveProperty('amount', 50);
  });

  it('returns 400 when payment not completed', async () => {
    authFreelancer();
    StripeConstructor.__mockRetrieve.mockResolvedValueOnce({
      id: 'pi_test_id', status: 'requires_payment_method', amount: 5000
    });

    const res = await request(app)
      .post('/api/payments/deposit/confirm')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ paymentIntentId: 'pi_test_id' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Payment not completed/);
  });

  it('returns 400 when paymentIntentId is missing', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/payments/deposit/confirm')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/paymentIntentId/);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .post('/api/payments/deposit/confirm')
      .send({ paymentIntentId: 'pi_test_id' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .post('/api/payments/deposit/confirm')
      .set('Authorization', `Bearer ${invalidToken}`)
      .send({ paymentIntentId: 'pi_test_id' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .post('/api/payments/deposit/confirm')
      .set('Authorization', `Bearer ${expiredFreelancerToken}`)
      .send({ paymentIntentId: 'pi_test_id' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/payments/deposit/confirm')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ paymentIntentId: 'pi_test_id' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeFreelancerRow, status: 'suspended' }] });
    const res = await request(app)
      .post('/api/payments/deposit/confirm')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ paymentIntentId: 'pi_test_id' });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });

  it('rolls back transaction and returns 500 when wallet update throws', async () => {
    authFreelancer();

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce(new Error('Wallet update failed')); // update wallet fails

    const res = await request(app)
      .post('/api/payments/deposit/confirm')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ paymentIntentId: 'pi_test_id' });

    expect(res.status).toBe(500);
    // ROLLBACK must have been called
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    // connection must be released even on error
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('rolls back and releases connection when transaction INSERT throws', async () => {
    authFreelancer();

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // wallet update succeeds
      .mockRejectedValueOnce(new Error('Transaction insert failed')); // INSERT fails

    const res = await request(app)
      .post('/api/payments/deposit/confirm')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ paymentIntentId: 'pi_test_id' });

    expect(res.status).toBe(500);
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('releases the DB connection on successful deposit', async () => {
    authFreelancer();

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // wallet update
      .mockResolvedValueOnce({ rows: [] }) // insert transaction
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await request(app)
      .post('/api/payments/deposit/confirm')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ paymentIntentId: 'pi_test_id' });

    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('returns 500 when Stripe retrieve throws', async () => {
    authFreelancer();
    StripeConstructor.__mockRetrieve.mockRejectedValueOnce(new Error('Stripe API error'));

    const res = await request(app)
      .post('/api/payments/deposit/confirm')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ paymentIntentId: 'pi_test_id' });

    expect(res.status).toBe(500);
  });
});

// ── POST /api/payments/withdraw ────────────────────────────────────────────

describe('POST /api/payments/withdraw', () => {
  it('returns 200 when withdrawal is submitted', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ balance: 200 }] });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // deduct wallet
      .mockResolvedValueOnce({ rows: [{ id: 'tx-id', type: 'withdrawal', amount: 100 }] }) // insert transaction
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/payments/withdraw')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 100, method: 'bank_transfer', accountDetails: { accountNumber: '1234' } });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Withdrawal request submitted');
    expect(res.body).toHaveProperty('transaction');
  });

  it('returns 400 when amount is less than 50', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/payments/withdraw')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 30, method: 'bank_transfer' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Minimum withdrawal/);
  });

  it('returns 400 when balance is insufficient', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ balance: 30 }] });

    const res = await request(app)
      .post('/api/payments/withdraw')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 100, method: 'bank_transfer' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Insufficient balance/);
  });

  it('returns 400 when amount is missing', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/payments/withdraw')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ method: 'bank_transfer' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/amount/);
  });

  it('returns 400 when method is missing', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/payments/withdraw')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 100 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/method/);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .post('/api/payments/withdraw')
      .send({ amount: 100, method: 'bank_transfer' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .post('/api/payments/withdraw')
      .set('Authorization', `Bearer ${invalidToken}`)
      .send({ amount: 100, method: 'bank_transfer' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .post('/api/payments/withdraw')
      .set('Authorization', `Bearer ${expiredFreelancerToken}`)
      .send({ amount: 100, method: 'bank_transfer' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/payments/withdraw')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 100, method: 'bank_transfer' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeFreelancerRow, status: 'suspended' }] });
    const res = await request(app)
      .post('/api/payments/withdraw')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 100, method: 'bank_transfer' });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });

  it('accepts exactly the minimum withdrawal amount of 50', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ balance: 200 }] });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'tx-id', type: 'withdrawal', amount: 50 }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/payments/withdraw')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 50, method: 'bank_transfer' });

    expect(res.status).toBe(200);
  });

  it('returns 400 when wallet does not exist', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [] }); // wallet not found

    const res = await request(app)
      .post('/api/payments/withdraw')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 100, method: 'bank_transfer' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Wallet not found');
  });

  it('rolls back and releases connection when transaction INSERT throws', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ balance: 200 }] });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // wallet deduction succeeds
      .mockRejectedValueOnce(new Error('Transaction insert failed')); // INSERT fails

    const res = await request(app)
      .post('/api/payments/withdraw')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 100, method: 'bank_transfer', accountDetails: { accountNumber: '1234' } });

    expect(res.status).toBe(500);
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('rolls back transaction and returns 500 when wallet deduction throws', async () => {
    authFreelancer();
    mockQuery.mockResolvedValueOnce({ rows: [{ balance: 200 }] });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce(new Error('Wallet deduction failed')); // deduct wallet fails

    const res = await request(app)
      .post('/api/payments/withdraw')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 100, method: 'bank_transfer', accountDetails: { accountNumber: '1234' } });

    expect(res.status).toBe(500);
    // ROLLBACK must have been called
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    // connection must be released even on error
    expect(mockClientRelease).toHaveBeenCalled();
  });
});

// ── GET /api/payments/stripe/key ───────────────────────────────────────────

describe('GET /api/payments/stripe/key', () => {
  it('returns 200 with Stripe publishable key', async () => {
    authFreelancer();

    const res = await request(app)
      .get('/api/payments/stripe/key')
      .set('Authorization', `Bearer ${freelancerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('publishableKey');
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/payments/stripe/key');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/payments/stripe/key')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .get('/api/payments/stripe/key')
      .set('Authorization', `Bearer ${expiredFreelancerToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/payments/stripe/key')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeFreelancerRow, status: 'suspended' }] });
    const res = await request(app)
      .get('/api/payments/stripe/key')
      .set('Authorization', `Bearer ${freelancerToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });
});

// ── POST /api/payments/escrow/fund ─────────────────────────────────────────

describe('POST /api/payments/escrow/fund', () => {
  it('returns 200 when escrow is funded', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'contract-id', client_id: 'client-user-id', freelancer_id: 'freelancer-id', project_title: 'Test Project' }]
      })
      .mockResolvedValueOnce({ rows: [{ balance: 500 }] })
      .mockResolvedValueOnce({ rows: [{ value: '10' }] });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // deduct client
      .mockResolvedValueOnce({ rows: [] }) // add to escrow
      .mockResolvedValueOnce({ rows: [{ id: 'escrow-id' }] }) // create escrow
      .mockResolvedValueOnce({ rows: [] }) // create transaction
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ contractId: 'contract-id', amount: 200 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Escrow funded successfully');
  });

  it('returns 400 when contractId or amount missing', async () => {
    authClient();

    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ amount: 200 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('returns 404 when contract not found', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ contractId: 'nonexistent', amount: 200 });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Contract not found');
  });

  it('returns 403 when freelancer tries to fund escrow', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ contractId: 'contract-id', amount: 200 });

    expect(res.status).toBe(403);
  });

  it('returns 400 when amount is zero', async () => {
    authClient();

    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ contractId: 'contract-id', amount: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('returns 400 when amount is negative', async () => {
    authClient();

    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ contractId: 'contract-id', amount: -50 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('returns 400 when amount is a string (not a number)', async () => {
    authClient();

    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ contractId: 'contract-id', amount: '200' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('returns 403 when a different client tries to fund a contract they do not own', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({
        // contract belongs to a DIFFERENT client
        rows: [{ id: 'contract-id', client_id: 'other-client-id', freelancer_id: 'freelancer-id', project_title: 'Test' }]
      })
      .mockResolvedValueOnce({ rows: [{ balance: 500 }] })
      .mockResolvedValueOnce({ rows: [{ value: '10' }] });

    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ contractId: 'contract-id', amount: 200 });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Not authorized');
  });

  it('returns 400 when wallet is missing (no wallet row)', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'contract-id', client_id: 'client-user-id', freelancer_id: 'freelancer-id', project_title: 'Test' }]
      })
      .mockResolvedValueOnce({ rows: [] }); // no wallet

    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ contractId: 'contract-id', amount: 200 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Insufficient balance/);
  });

  it('defaults platform fee to 10% when platform_settings has no matching row', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'contract-id', client_id: 'client-user-id', freelancer_id: 'freelancer-id', project_id: 'proj-1', project_title: 'Test' }]
      })
      .mockResolvedValueOnce({ rows: [{ balance: 500 }] })
      .mockResolvedValueOnce({ rows: [] }); // no platform_settings row → defaults to 10%

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // deduct client
      .mockResolvedValueOnce({ rows: [] }) // add to escrow — amount - 10% fee
      .mockResolvedValueOnce({ rows: [{ id: 'escrow-id' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ contractId: 'contract-id', amount: 100 });

    expect(res.status).toBe(200);
    // escrow INSERT should use 10% platform fee → 10 on a 100 amount
    const escrowInsertCall = mockClientQuery.mock.calls[3];
    expect(escrowInsertCall[1]).toContain(10); // platform_fee = 10
  });

  it('returns 400 when insufficient balance', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'contract-id', client_id: 'client-user-id', freelancer_id: 'freelancer-id', project_title: 'Test Project' }]
      })
      .mockResolvedValueOnce({ rows: [{ balance: 100 }] }) // insufficient balance
      .mockResolvedValueOnce({ rows: [{ value: '10' }] });

    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ contractId: 'contract-id', amount: 200 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Insufficient balance/);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .send({ contractId: 'contract-id', amount: 200 });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${invalidToken}`)
      .send({ contractId: 'contract-id', amount: 200 });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${expiredClientToken}`)
      .send({ contractId: 'contract-id', amount: 200 });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ contractId: 'contract-id', amount: 200 });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeClientRow, status: 'suspended' }] });
    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ contractId: 'contract-id', amount: 200 });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });

  it('rolls back transaction and returns 500 when escrow creation throws', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'contract-id', client_id: 'client-user-id', freelancer_id: 'freelancer-id', project_title: 'Test Project' }]
      })
      .mockResolvedValueOnce({ rows: [{ balance: 500 }] })
      .mockResolvedValueOnce({ rows: [{ value: '10' }] });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // deduct client
      .mockResolvedValueOnce({ rows: [] }) // add to escrow
      .mockRejectedValueOnce(new Error('Escrow creation failed')); // create escrow fails

    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ contractId: 'contract-id', amount: 200 });

    expect(res.status).toBe(500);
    // ROLLBACK must have been called
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    // connection must be released even on error
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('rolls back and releases connection when transaction INSERT throws', async () => {
    authClient();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'contract-id', client_id: 'client-user-id', freelancer_id: 'freelancer-id', project_id: 'proj-1', project_title: 'Test' }]
      })
      .mockResolvedValueOnce({ rows: [{ balance: 500 }] })
      .mockResolvedValueOnce({ rows: [{ value: '10' }] });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // deduct client
      .mockResolvedValueOnce({ rows: [] }) // add to escrow
      .mockResolvedValueOnce({ rows: [{ id: 'escrow-id' }] }) // create escrow
      .mockRejectedValueOnce(new Error('Transaction record failed')); // INSERT fails

    const res = await request(app)
      .post('/api/payments/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ contractId: 'contract-id', amount: 200 });

    expect(res.status).toBe(500);
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClientRelease).toHaveBeenCalled();
  });
});

// ── POST /api/payments/escrow/release ──────────────────────────────────────

describe('POST /api/payments/escrow/release', () => {
  it('returns 200 when escrow is released', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'escrow-id', client_id: 'client-user-id', freelancer_id: 'freelancer-id',
        amount: 200, platform_fee: 20, status: 'held', project_title: 'Test Project'
      }]
    });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // move from escrow to balance
      .mockResolvedValueOnce({ rows: [] }) // update escrow status
      .mockResolvedValueOnce({ rows: [] }) // create transaction
      .mockResolvedValueOnce({ rows: [] }) // update profile
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/payments/escrow/release')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ escrowId: 'escrow-id' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Payment released successfully');
    expect(res.body.amount).toBe(180);
  });

  it('returns 404 when escrow not found', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/payments/escrow/release')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ escrowId: 'nonexistent' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Escrow not found');
  });

  it('returns 400 when escrow is not in held status', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'escrow-id', client_id: 'client-user-id', freelancer_id: 'freelancer-id',
        amount: 200, platform_fee: 20, status: 'released', project_title: 'Test'
      }]
    });

    const res = await request(app)
      .post('/api/payments/escrow/release')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ escrowId: 'escrow-id' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/held status/);
  });

  it('returns 400 when escrowId is missing', async () => {
    authClient();

    const res = await request(app)
      .post('/api/payments/escrow/release')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/escrowId/);
  });

  it('returns 403 when a different client tries to release escrow they do not own', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'escrow-id', client_id: 'other-client-id', freelancer_id: 'freelancer-id',
        amount: 200, platform_fee: 20, status: 'held', project_title: 'Test'
      }]
    });

    const res = await request(app)
      .post('/api/payments/escrow/release')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ escrowId: 'escrow-id' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Not authorized');
  });

  it('allows admin to release escrow regardless of client_id', async () => {
    authAdmin();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'escrow-id', client_id: 'some-other-client-id', freelancer_id: 'freelancer-id',
        amount: 200, platform_fee: 20, status: 'held', project_title: 'Admin Release Test'
      }]
    });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // move to balance
      .mockResolvedValueOnce({ rows: [] }) // update escrow status
      .mockResolvedValueOnce({ rows: [] }) // create transaction
      .mockResolvedValueOnce({ rows: [] }) // update profile
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/payments/escrow/release')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ escrowId: 'escrow-id' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Payment released successfully');
  });

  it('returns 403 when freelancer tries to release escrow', async () => {
    authFreelancer();

    const res = await request(app)
      .post('/api/payments/escrow/release')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ escrowId: 'escrow-id' });

    expect(res.status).toBe(403);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .post('/api/payments/escrow/release')
      .send({ escrowId: 'escrow-id' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .post('/api/payments/escrow/release')
      .set('Authorization', `Bearer ${invalidToken}`)
      .send({ escrowId: 'escrow-id' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app)
      .post('/api/payments/escrow/release')
      .set('Authorization', `Bearer ${expiredClientToken}`)
      .send({ escrowId: 'escrow-id' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expired');
  });

  it('returns 401 when token user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/payments/escrow/release')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ escrowId: 'escrow-id' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  it('returns 403 when account is suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeClientRow, status: 'suspended' }] });
    const res = await request(app)
      .post('/api/payments/escrow/release')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ escrowId: 'escrow-id' });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Account is suspended or banned');
  });

  it('rolls back transaction and returns 500 when escrow update throws', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'escrow-id', client_id: 'client-user-id', freelancer_id: 'freelancer-id',
        amount: 200, platform_fee: 20, status: 'held', project_title: 'Test Project'
      }]
    });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // move from escrow to balance
      .mockRejectedValueOnce(new Error('Escrow update failed')); // update escrow status fails

    const res = await request(app)
      .post('/api/payments/escrow/release')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ escrowId: 'escrow-id' });

    expect(res.status).toBe(500);
    // ROLLBACK must have been called
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    // connection must be released even on error
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('rolls back and releases connection when transaction INSERT throws', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'escrow-id', client_id: 'client-user-id', freelancer_id: 'freelancer-id',
        amount: 200, platform_fee: 20, status: 'held', project_title: 'Test'
      }]
    });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // move escrow to balance
      .mockResolvedValueOnce({ rows: [] }) // update escrow status
      .mockRejectedValueOnce(new Error('Transaction insert failed')); // create transaction fails

    const res = await request(app)
      .post('/api/payments/escrow/release')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ escrowId: 'escrow-id' });

    expect(res.status).toBe(500);
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('rolls back and releases connection when profile update throws', async () => {
    authClient();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'escrow-id', client_id: 'client-user-id', freelancer_id: 'freelancer-id',
        amount: 200, platform_fee: 20, status: 'held', project_title: 'Test'
      }]
    });

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // move escrow to balance
      .mockResolvedValueOnce({ rows: [] }) // update escrow status
      .mockResolvedValueOnce({ rows: [] }) // create transaction
      .mockRejectedValueOnce(new Error('Profile update failed')); // update profile fails

    const res = await request(app)
      .post('/api/payments/escrow/release')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ escrowId: 'escrow-id' });

    expect(res.status).toBe(500);
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClientRelease).toHaveBeenCalled();
  });
});
