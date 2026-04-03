import request from 'supertest';
import { app } from './testApp';
import { db } from '../index';
import {
  freelancerToken, clientToken,
  activeFreelancerRow, activeClientRow
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

const mockQuery = db.query as jest.Mock;
const mockConnect = db.connect as jest.Mock;
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();

beforeEach(() => {
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
});
