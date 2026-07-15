const express = require("express");
const pool = require("../config/db");
const { createWalletAlert } = require("./mobileRoutes");

const router = express.Router();

const VALID_TYPES = ["fund", "withdraw", "transfer", "plan_payment", "refund"];
const CREDIT_TYPES = ["fund", "transfer_in", "refund"];
const DEBIT_TYPES = ["withdraw", "transfer_out", "plan_payment"];

const VIRTUAL_ACCOUNT_BANK = "Elohim Monnify MFB";

const ensureWalletTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      plan_id INTEGER REFERENCES grain_plans(id) ON DELETE SET NULL,
      type VARCHAR(30) NOT NULL,
      direction VARCHAR(10) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wallet_virtual_accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      account_number VARCHAR(30) UNIQUE NOT NULL,
      account_name VARCHAR(255) NOT NULL,
      bank_name VARCHAR(255) NOT NULL,
      provider VARCHAR(50) DEFAULT 'monnify',
      status VARCHAR(30) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wallet_virtual_account_deposits (
      id SERIAL PRIMARY KEY,
      virtual_account_id INTEGER REFERENCES wallet_virtual_accounts(id) ON DELETE SET NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      account_number VARCHAR(30) NOT NULL,
      sender_name VARCHAR(255),
      reference VARCHAR(100) UNIQUE NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(30) DEFAULT 'confirmed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const createAccountNumber = (userId) => {
  const seed = String(userId || "0").padStart(6, "0").slice(-6);
  const checksum = String((Number(userId || 0) * 37 + 918273) % 10000).padStart(4, "0");
  return `88${seed}${checksum}`.slice(0, 10);
};

const getOrCreateVirtualAccount = async (userId, client = pool) => {
  const existing = await client.query(
    "SELECT * FROM wallet_virtual_accounts WHERE user_id=$1",
    [userId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const user = await client.query("SELECT id, name FROM users WHERE id=$1", [userId]);

  if (user.rows.length === 0) {
    throw new Error("User not found");
  }

  const accountNumber = createAccountNumber(userId);
  const result = await client.query(
    `INSERT INTO wallet_virtual_accounts
      (user_id, account_number, account_name, bank_name)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id) DO UPDATE
       SET account_number=EXCLUDED.account_number
     RETURNING *`,
    [
      userId,
      accountNumber,
      `ELOHIM WALLET/${String(user.rows[0].name || "CUSTOMER").toUpperCase()}`,
      VIRTUAL_ACCOUNT_BANK,
    ]
  );

  return result.rows[0];
};

const parseAmount = (amount) => {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value * 100) / 100;
};

const getWalletBalance = async (userId, client = pool) => {
  const result = await client.query(
    `SELECT COALESCE(SUM(
      CASE
        WHEN direction = 'credit' THEN amount
        WHEN direction = 'debit' THEN -amount
        ELSE 0
      END
    ), 0) AS balance
    FROM wallet_transactions
    WHERE user_id=$1`,
    [userId]
  );

  return Number(result.rows[0]?.balance || 0);
};

const insertTransaction = async (
  client,
  { userId, relatedUserId = null, planId = null, type, direction, amount, note = null }
) => {
  return client.query(
    `INSERT INTO wallet_transactions
      (user_id, related_user_id, plan_id, type, direction, amount, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [userId, relatedUserId, planId, type, direction, amount, note]
  );
};

router.get("/:userId", async (req, res) => {
  try {
    await ensureWalletTables();

    const balance = await getWalletBalance(req.params.userId);
    const virtualAccount = await getOrCreateVirtualAccount(req.params.userId);
    const transactions = await pool.query(
      `SELECT wt.*, u.name AS related_user_name
       FROM wallet_transactions wt
       LEFT JOIN users u ON wt.related_user_id = u.id
       WHERE wt.user_id=$1
       ORDER BY wt.created_at DESC, wt.id DESC
       LIMIT 30`,
      [req.params.userId]
    );

    res.json({ balance, virtual_account: virtualAccount, transactions: transactions.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load wallet" });
  }
});

router.post("/virtual-accounts/confirm-transfer", async (req, res) => {
  const { account_number, amount, sender_name, reference } = req.body;
  const depositAmount = parseAmount(amount);
  const normalizedReference =
    String(reference || "").trim() || `VA-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

  if (!account_number || !depositAmount) {
    return res.status(400).json({ error: "Account number and amount are required" });
  }

  const client = await pool.connect();

  try {
    await ensureWalletTables();
    await client.query("BEGIN");

    const account = await client.query(
      "SELECT * FROM wallet_virtual_accounts WHERE account_number=$1 AND status='active'",
      [account_number]
    );

    if (account.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Virtual account not found" });
    }

    const virtualAccount = account.rows[0];

    const duplicate = await client.query(
      "SELECT id FROM wallet_virtual_account_deposits WHERE reference=$1",
      [normalizedReference]
    );

    if (duplicate.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Transfer reference already confirmed" });
    }

    const deposit = await client.query(
      `INSERT INTO wallet_virtual_account_deposits
        (virtual_account_id, user_id, account_number, sender_name, reference, amount)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        virtualAccount.id,
        virtualAccount.user_id,
        account_number,
        sender_name || "Bank transfer",
        normalizedReference,
        depositAmount,
      ]
    );

    await insertTransaction(client, {
      userId: virtualAccount.user_id,
      type: "virtual_account_deposit",
      direction: "credit",
      amount: depositAmount,
      note: `Virtual account transfer confirmed: ${normalizedReference}`,
    });

    const balance = await getWalletBalance(virtualAccount.user_id, client);
    await createWalletAlert({
      userId: virtualAccount.user_id,
      direction: "credit",
      amount: depositAmount,
      balance,
      note: `Virtual account transfer confirmed: ${normalizedReference}`,
      client,
    });

    await client.query("COMMIT");

    res.json({
      message: "Transfer confirmed and wallet credited",
      balance,
      deposit: deposit.rows[0],
      virtual_account: virtualAccount,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("VIRTUAL ACCOUNT CONFIRM ERROR:", err);
    res.status(500).json({ error: "Failed to confirm virtual account transfer" });
  } finally {
    client.release();
  }
});

router.get("/admin/overview", async (req, res) => {
  try {
    await ensureWalletTables();

    const balances = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        va.account_number,
        va.account_name,
        va.bank_name,
        COALESCE(SUM(
          CASE
            WHEN wt.direction = 'credit' THEN wt.amount
            WHEN wt.direction = 'debit' THEN -wt.amount
            ELSE 0
          END
        ), 0) AS balance,
        COUNT(wt.id)::int AS transaction_count
      FROM users u
      LEFT JOIN wallet_transactions wt ON wt.user_id = u.id
      LEFT JOIN wallet_virtual_accounts va ON va.user_id = u.id
      GROUP BY u.id, u.name, u.email, va.account_number, va.account_name, va.bank_name
      HAVING COUNT(wt.id) > 0
      ORDER BY balance DESC, u.name ASC
    `);

    const transactions = await pool.query(`
      SELECT
        wt.*,
        u.name AS user_name,
        u.email AS user_email,
        related.name AS related_user_name,
        related.email AS related_user_email
      FROM wallet_transactions wt
      JOIN users u ON wt.user_id = u.id
      LEFT JOIN users related ON wt.related_user_id = related.id
      ORDER BY wt.created_at DESC, wt.id DESC
      LIMIT 80
    `);

    const totals = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN direction='credit' THEN amount ELSE 0 END), 0) AS total_credit,
        COALESCE(SUM(CASE WHEN direction='debit' THEN amount ELSE 0 END), 0) AS total_debit,
        COALESCE(SUM(CASE WHEN direction='credit' THEN amount ELSE -amount END), 0) AS total_balance
      FROM wallet_transactions
    `);

    const virtualAccounts = await pool.query(`
      SELECT
        va.*,
        u.name AS user_name,
        u.email AS user_email,
        COALESCE(SUM(d.amount), 0) AS total_deposits,
        COUNT(d.id)::int AS deposit_count
      FROM wallet_virtual_accounts va
      JOIN users u ON va.user_id = u.id
      LEFT JOIN wallet_virtual_account_deposits d ON d.virtual_account_id = va.id
      GROUP BY va.id, u.name, u.email
      ORDER BY va.id DESC
    `);

    res.json({
      totals: totals.rows[0],
      balances: balances.rows,
      virtual_accounts: virtualAccounts.rows,
      transactions: transactions.rows,
    });
  } catch (err) {
    console.error("ADMIN WALLET ERROR:", err);
    res.status(500).json({ error: "Failed to load wallet overview" });
  }
});

router.post("/:userId/fund", async (req, res) => {
  const amount = parseAmount(req.body.amount);

  if (!amount) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }

  try {
    await ensureWalletTables();
    const result = await insertTransaction(pool, {
      userId: req.params.userId,
      type: "fund",
      direction: "credit",
      amount,
      note: req.body.note || "Wallet funding",
    });

    const balance = await getWalletBalance(req.params.userId);
    await createWalletAlert({
      userId: req.params.userId,
      direction: "credit",
      amount,
      balance,
      note: req.body.note || "Wallet funding",
    });

    res.json({ balance, transaction: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fund wallet" });
  }
});

router.post("/:userId/withdraw", async (req, res) => {
  const amount = parseAmount(req.body.amount);

  if (!amount) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }

  const client = await pool.connect();

  try {
    await ensureWalletTables();
    await client.query("BEGIN");

    const balance = await getWalletBalance(req.params.userId, client);

    if (amount > balance) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient wallet balance" });
    }

    const result = await insertTransaction(client, {
      userId: req.params.userId,
      type: "withdraw",
      direction: "debit",
      amount,
      note: req.body.note || "Wallet withdrawal",
    });
    const nextBalance = balance - amount;

    await createWalletAlert({
      userId: req.params.userId,
      direction: "debit",
      amount,
      balance: nextBalance,
      note: req.body.note || "Wallet withdrawal",
      client,
    });

    await client.query("COMMIT");

    res.json({
      balance: nextBalance,
      transaction: result.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Withdrawal failed" });
  } finally {
    client.release();
  }
});

router.post("/:userId/transfer", async (req, res) => {
  const amount = parseAmount(req.body.amount);
  const recipientEmail = String(req.body.recipient_email || "").trim().toLowerCase();

  if (!amount) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }

  if (!recipientEmail) {
    return res.status(400).json({ error: "Recipient email is required" });
  }

  const client = await pool.connect();

  try {
    await ensureWalletTables();
    await client.query("BEGIN");

    const recipient = await client.query(
      "SELECT id, name, email FROM users WHERE LOWER(email)=$1",
      [recipientEmail]
    );

    if (recipient.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Recipient not found" });
    }

    const recipientUser = recipient.rows[0];

    if (String(recipientUser.id) === String(req.params.userId)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot transfer to yourself" });
    }

    const balance = await getWalletBalance(req.params.userId, client);

    if (amount > balance) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient wallet balance" });
    }

    await insertTransaction(client, {
      userId: req.params.userId,
      relatedUserId: recipientUser.id,
      type: "transfer_out",
      direction: "debit",
      amount,
      note: `Transfer to ${recipientUser.email}`,
    });

    await insertTransaction(client, {
      userId: recipientUser.id,
      relatedUserId: req.params.userId,
      type: "transfer_in",
      direction: "credit",
      amount,
      note: "Wallet transfer received",
    });
    const senderBalance = balance - amount;

    await createWalletAlert({
      userId: req.params.userId,
      direction: "debit",
      amount,
      balance: senderBalance,
      note: `Transfer to ${recipientUser.email}`,
      client,
    });

    await createWalletAlert({
      userId: recipientUser.id,
      direction: "credit",
      amount,
      note: "Wallet transfer received",
      client,
    });

    await client.query("COMMIT");

    res.json({
      balance: senderBalance,
      recipient: recipientUser,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Transfer failed" });
  } finally {
    client.release();
  }
});

module.exports = {
  router,
  ensureWalletTables,
  getWalletBalance,
  insertTransaction,
  parseAmount,
  VALID_TYPES,
  CREDIT_TYPES,
  DEBIT_TYPES,
  getOrCreateVirtualAccount,
};
