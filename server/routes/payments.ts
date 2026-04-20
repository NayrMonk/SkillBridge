import { Router } from 'express';
import Stripe from 'stripe';
import { db } from '../index.ts';
import { AuthRequest, requireRole } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-12-18.acacia'
});

// Get wallet info
router.get('/wallet', asyncHandler(async (req: AuthRequest, res) => {
  const result = await db.query(
    `SELECT w.*, 
      (SELECT json_agg(t.*)
       FROM (SELECT * FROM transactions t WHERE t.wallet_id = w.id ORDER BY t.created_at DESC LIMIT 10) as t) as recent_transactions
     FROM wallets w
     WHERE w.user_id = $1`,
    [req.user!.userId]
  );

  if (result.rows.length === 0) {
    // Create wallet if doesn't exist
    const newWallet = await db.query(
      `INSERT INTO wallets (user_id, balance, currency)
       VALUES ($1, 0, 'USD')
       RETURNING *`,
      [req.user!.userId]
    );
    return res.json({ wallet: newWallet.rows[0], recentTransactions: [] });
  }

  const wallet = result.rows[0];

  res.json({
    wallet: {
      id: wallet.id,
      balance: wallet.balance,
      escrowBalance: wallet.escrow_balance,
      totalDeposited: wallet.total_deposited,
      totalWithdrawn: wallet.total_withdrawn,
      currency: wallet.currency
    },
    recentTransactions: wallet.recent_transactions || []
  });
}));

// Get transaction history
router.get('/transactions', asyncHandler(async (req: AuthRequest, res) => {
  const { type, status, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let query = `
    SELECT t.*, p.title as project_title
    FROM transactions t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.user_id = $1
  `;

  const params: any[] = [req.user!.userId];
  let paramIndex = 2;

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

  // Get total count
  let countQuery = 'SELECT COUNT(*) FROM transactions WHERE user_id = $1';
  const countParams: any[] = [req.user!.userId];

  if (type) {
    countQuery += ' AND type = $2';
    countParams.push(type);
  }

  if (status) {
    countQuery += ' AND status = $3';
    countParams.push(status);
  }

  const countResult = await db.query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].count);

  res.json({
    transactions: result.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit))
    }
  });
}));

// Create deposit intent (Stripe)
router.post('/deposit/intent', asyncHandler(async (req: AuthRequest, res) => {
  const { amount } = req.body;

  if (!amount || amount < 10 || typeof amount !== 'number') {
    return res.status(400).json({ error: 'Minimum deposit amount is $10' });
  }

  try {
    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        userId: req.user!.userId,
        type: 'deposit'
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount
    });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
}));

// Confirm deposit (webhook or manual confirmation)
router.post('/deposit/confirm', asyncHandler(async (req: AuthRequest, res) => {
  const { paymentIntentId } = req.body;

  if (!paymentIntentId || typeof paymentIntentId !== 'string') {
    return res.status(400).json({ error: 'paymentIntentId is required' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const amount = paymentIntent.amount / 100;

    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Update wallet
      await client.query(
        `UPDATE wallets 
         SET balance = balance + $1, total_deposited = total_deposited + $1
         WHERE user_id = $2`,
        [amount, req.user!.userId]
      );

      // Create transaction record
      await client.query(
        `INSERT INTO transactions (wallet_id, user_id, type, amount, status, description, stripe_payment_intent_id, completed_at)
         SELECT w.id, $1, 'deposit', $2, 'completed', $3, $4, CURRENT_TIMESTAMP
         FROM wallets w WHERE w.user_id = $1`,
        [req.user!.userId, amount, 'Wallet deposit', paymentIntentId]
      );

      await client.query('COMMIT');

      res.json({
        message: 'Deposit successful',
        amount
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Deposit confirmation error:', error);
    res.status(500).json({ error: 'Failed to confirm deposit' });
  }
}));

// Withdraw funds
router.post('/withdraw', asyncHandler(async (req: AuthRequest, res) => {
  const { amount, method, accountDetails } = req.body;

  if (!amount || amount < 50) {
    return res.status(400).json({ error: 'Minimum withdrawal amount is $50' });
  }

  if (!method || typeof method !== 'string') {
    return res.status(400).json({ error: 'Withdrawal method is required' });
  }

  // Get wallet
  const walletResult = await db.query(
    'SELECT balance FROM wallets WHERE user_id = $1',
    [req.user!.userId]
  );

  if (walletResult.rows.length === 0) {
    return res.status(400).json({ error: 'Wallet not found' });
  }

  const wallet = walletResult.rows[0];

  if (wallet.balance < amount) {
    return res.status(400).json({
      error: 'Insufficient balance',
      requested: amount,
      available: wallet.balance
    });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Deduct from wallet
    await client.query(
      `UPDATE wallets 
       SET balance = balance - $1, total_withdrawn = total_withdrawn + $1
       WHERE user_id = $2`,
      [amount, req.user!.userId]
    );

    // Create pending transaction
    const transactionResult = await client.query(
      `INSERT INTO transactions (wallet_id, user_id, type, amount, status, description, metadata)
       SELECT w.id, $1, 'withdrawal', $2, 'pending', $3, $4
       FROM wallets w WHERE w.user_id = $1
       RETURNING *`,
      [
        req.user!.userId,
        amount,
        `Withdrawal to ${method}`,
        JSON.stringify({ method, accountDetails })
      ]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Withdrawal request submitted',
      transaction: transactionResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Fund project escrow (client)
router.post('/escrow/fund', requireRole(['client', 'admin']), asyncHandler(async (req: AuthRequest, res) => {
  const { contractId, milestoneId, amount } = req.body;

  if (!contractId || !amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Contract ID and valid amount are required' });
  }

  // Verify contract ownership
  const contractResult = await db.query(
    `SELECT c.*, p.title as project_title
     FROM contracts c
     JOIN projects p ON c.project_id = p.id
     WHERE c.id = $1`,
    [contractId]
  );

  if (contractResult.rows.length === 0) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  const contract = contractResult.rows[0];

  if (contract.client_id !== req.user!.userId && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // Get wallet
  const walletResult = await db.query(
    'SELECT balance FROM wallets WHERE user_id = $1',
    [req.user!.userId]
  );

  const wallet = walletResult.rows[0];

  if (!wallet || wallet.balance < amount) {
    return res.status(400).json({
      error: 'Insufficient balance',
      required: amount,
      available: wallet?.balance || 0
    });
  }

  // Get platform fee
  const feeResult = await db.query(
    "SELECT value FROM platform_settings WHERE key = 'platform_fee_percentage'"
  );
  const platformFeePercent = parseFloat(feeResult.rows[0]?.value || '10');
  const platformFee = (amount * platformFeePercent) / 100;

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Deduct from client wallet
    await client.query(
      'UPDATE wallets SET balance = balance - $1 WHERE user_id = $2',
      [amount, req.user!.userId]
    );

    // Add to escrow
    await client.query(
      'UPDATE wallets SET escrow_balance = escrow_balance + $1 WHERE user_id = $2',
      [amount - platformFee, contract.freelancer_id]
    );

    // Create escrow record
    const escrowResult = await client.query(
      `INSERT INTO escrow (contract_id, milestone_id, client_id, freelancer_id, amount, platform_fee)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [contractId, milestoneId || null, req.user!.userId, contract.freelancer_id, amount, platformFee]
    );

    // Create transaction records
    await client.query(
      `INSERT INTO transactions (wallet_id, user_id, type, amount, status, description, project_id, contract_id, completed_at)
       SELECT w.id, $1, 'escrow_deposit', $2, 'completed', $3, $4, $5, CURRENT_TIMESTAMP
       FROM wallets w WHERE w.user_id = $1`,
      [req.user!.userId, amount, `Escrow funding for: ${contract.project_title}`, contract.project_id, contractId]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Escrow funded successfully',
      escrow: escrowResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Release escrow payment (client)
router.post('/escrow/release', requireRole(['client', 'admin']), asyncHandler(async (req: AuthRequest, res) => {
  const { escrowId } = req.body;

  if (!escrowId || (typeof escrowId !== 'string' && typeof escrowId !== 'number')) {
    return res.status(400).json({ error: 'escrowId is required' });
  }

  // Get escrow
  const escrowResult = await db.query(
    `SELECT e.*, p.title as project_title
     FROM escrow e
     JOIN contracts c ON e.contract_id = c.id
     JOIN projects p ON c.project_id = p.id
     WHERE e.id = $1`,
    [escrowId]
  );

  if (escrowResult.rows.length === 0) {
    return res.status(404).json({ error: 'Escrow not found' });
  }

  const escrow = escrowResult.rows[0];

  if (escrow.client_id !== req.user!.userId && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  if (escrow.status !== 'held') {
    return res.status(400).json({ error: 'Escrow is not in held status' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Move from escrow to freelancer balance
    await client.query(
      `UPDATE wallets 
       SET escrow_balance = escrow_balance - $1,
           balance = balance + $1,
           total_earnings = total_earnings + $1
       WHERE user_id = $2`,
      [escrow.amount - escrow.platform_fee, escrow.freelancer_id]
    );

    // Update escrow status
    await client.query(
      `UPDATE escrow 
       SET status = 'released', released_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [escrowId]
    );

    // Create transaction for freelancer
    await client.query(
      `INSERT INTO transactions (wallet_id, user_id, type, amount, fee, status, description, completed_at)
       SELECT w.id, $1, 'escrow_release', $2, $3, 'completed', $4, CURRENT_TIMESTAMP
       FROM wallets w WHERE w.user_id = $1`,
      [
        escrow.freelancer_id,
        escrow.amount - escrow.platform_fee,
        escrow.platform_fee,
        `Payment received for: ${escrow.project_title}`
      ]
    );

    // Update freelancer profile
    await client.query(
      `UPDATE profiles 
       SET total_earnings = total_earnings + $1, jobs_completed = jobs_completed + 1
       WHERE user_id = $2`,
      [escrow.amount - escrow.platform_fee, escrow.freelancer_id]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Payment released successfully',
      amount: escrow.amount - escrow.platform_fee
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Get Stripe publishable key
router.get('/stripe/key', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder'
  });
});

export default router;
