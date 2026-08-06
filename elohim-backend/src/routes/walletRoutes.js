const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../config/db");
const { createWalletAlert } = require("./mobileRoutes");
const { verifyToken, isAdmin } = require("../middleware/auth");
const { normalizePhone, canonicalPhone } = require("../utils/phone");

const router = express.Router();

const VALID_TYPES = ["fund", "withdraw", "transfer", "plan_payment", "refund"];
const CREDIT_TYPES = ["fund", "transfer_in", "refund"];
const DEBIT_TYPES = ["withdraw", "transfer_out", "plan_payment"];

const VIRTUAL_ACCOUNT_BANK = "Elohim Monnify MFB";

let _walletTablesReady = false;
const ensureWalletTables = async () => {
  if (_walletTablesReady) return;
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS wallet_pin VARCHAR(255)
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS wallet_pin_set BOOLEAN DEFAULT FALSE
  `);

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
      wallet_number VARCHAR(20) UNIQUE,
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

  await pool.query(`
    ALTER TABLE wallet_virtual_accounts
    ADD COLUMN IF NOT EXISTS wallet_number VARCHAR(20)
  `);

  // only backfill rows whose phone won't violate the unique constraint
  await pool.query(`
    UPDATE wallet_virtual_accounts va
    SET wallet_number = u.phone
    FROM users u
    WHERE va.user_id = u.id
      AND va.wallet_number IS NULL
      AND u.phone IS NOT NULL
      AND TRIM(u.phone) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM wallet_virtual_accounts va2
        WHERE va2.wallet_number = u.phone
          AND va2.user_id <> va.user_id
      )
  `);
  _walletTablesReady = true;
};

const verifyWalletPin = async (userId, pin) => {
  const result = await pool.query(
    `
    SELECT wallet_pin
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error("User not found");
  }

  const walletPin = result.rows[0].wallet_pin;

  if (!walletPin) {
    return false;
  }

  return bcrypt.compare(pin, walletPin);
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

  if (existing.rows.length > 0 && existing.rows[0].wallet_number) {
    return existing.rows[0];
  }

  const user = await client.query("SELECT id, name, phone FROM users WHERE id=$1", [userId]);

  if (user.rows.length === 0) {
    throw new Error("User not found");
  }

  const accountNumber = createAccountNumber(userId);
  const rawWalletNumber = normalizePhone(user.rows[0].phone) || null;
  // avoid UNIQUE violation if another user already owns this phone as wallet_number
  const taken = rawWalletNumber
    ? await client.query(
        "SELECT 1 FROM wallet_virtual_accounts WHERE wallet_number=$1 AND user_id!=$2",
        [rawWalletNumber, userId]
      )
    : { rows: [] };
  const walletNumber = taken.rows.length > 0 ? null : rawWalletNumber;
  const result = await client.query(
    `INSERT INTO wallet_virtual_accounts
      (user_id, wallet_number, account_number, account_name, bank_name)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id) DO UPDATE
       SET wallet_number=EXCLUDED.wallet_number
     RETURNING *`,
    [
      userId,
      walletNumber,
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

router.get("/:userId", verifyToken, async (req, res) => {
  try {
    if (String(req.user.id) !== String(req.params.userId) && !req.user.is_admin) {
      return res.status(403).json({ error: "Not allowed" });
    }

    await ensureWalletTables().catch((e) => console.error("ensureWalletTables failed:", e));

    const balance = await getWalletBalance(req.params.userId);
    const virtualAccount = await getOrCreateVirtualAccount(req.params.userId);
    const userRes = await pool.query(
      `SELECT wallet_pin_set FROM users WHERE id=$1`,
      [req.params.userId]
    );
    const transactions = await pool.query(
      `SELECT wt.*, u.name AS related_user_name
       FROM wallet_transactions wt
       LEFT JOIN users u ON wt.related_user_id = u.id
       WHERE wt.user_id=$1
       ORDER BY wt.created_at DESC, wt.id DESC
       LIMIT 30`,
      [req.params.userId]
    );

    res.json({
      balance,
      wallet_number: virtualAccount.wallet_number,
      virtual_account: virtualAccount,
      transactions: transactions.rows,
      wallet_pin_set: Boolean(userRes.rows[0]?.wallet_pin_set),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load wallet" });
  }
});

router.post("/set-pin", verifyToken, async (req, res) => {
  try {
    const { pin, confirmPin } = req.body;

    if (!pin || !confirmPin) {
      return res.status(400).json({
        error: "PIN and confirmation are required",
      });
    }

    if (pin !== confirmPin) {
      return res.status(400).json({
        error: "PINs do not match",
      });
    }

    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        error: "PIN must be exactly 4 digits",
      });
    }

    const hashedPin = await bcrypt.hash(pin, 10);

    await pool.query(
      `
      UPDATE users
      SET wallet_pin = $1,
          wallet_pin_set = TRUE
      WHERE id = $2
      `,
      [hashedPin, req.user.id]
    );

    res.json({
      success: true,
      message: "Wallet PIN created successfully.",
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to create wallet PIN.",
    });
  }
});

router.post("/change-pin", verifyToken, async (req, res) => {
  try {
    const { oldPin, newPin, confirmPin } = req.body;

    if (!oldPin || !newPin || !confirmPin) {
      return res.status(400).json({ error: "Old PIN, new PIN and confirmation are required." });
    }

    if (newPin !== confirmPin) {
      return res.status(400).json({ error: "New PINs do not match." });
    }

    if (!/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ error: "New PIN must be exactly 4 digits." });
    }

    const validOldPin = await verifyWalletPin(req.user.id, oldPin);

    if (!validOldPin) {
      return res.status(401).json({ error: "Invalid old PIN." });
    }

    const hashedPin = await bcrypt.hash(newPin, 10);

    await pool.query(
      `
      UPDATE users
      SET wallet_pin = $1,
          wallet_pin_set = TRUE
      WHERE id = $2
      `,
      [hashedPin, req.user.id]
    );

    return res.json({
      success: true,
      message: "Wallet PIN changed successfully.",
    });
  } catch (err) {
    console.error("CHANGE WALLET PIN ERROR:", err);
    return res.status(500).json({ error: "Failed to change wallet PIN." });
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

router.get("/admin/phone-duplicates", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensureWalletTables();

    const usersWithPhone = await pool.query(`
      SELECT id, phone
      FROM users
      WHERE phone IS NOT NULL
        AND TRIM(phone) <> ''
    `);

    const grouped = new Map();

    for (const row of usersWithPhone.rows) {
      const canonical = canonicalPhone(row.phone);
      if (!canonical) {
        continue;
      }

      const current = grouped.get(canonical) || [];
      current.push(Number(row.id));
      grouped.set(canonical, current);
    }

    const duplicates = Array.from(grouped.entries())
      .filter(([, ids]) => ids.length > 1)
      .map(([canonical, ids]) => ({
        phone: canonical,
        duplicate_count: ids.length,
        user_ids: ids.sort((a, b) => a - b),
      }))
      .sort((a, b) => b.duplicate_count - a.duplicate_count || a.phone.localeCompare(b.phone));

    return res.json({
      duplicates,
      duplicate_groups: duplicates.length,
    });
  } catch (err) {
    console.error("PHONE DUPLICATE LIST ERROR:", err);
    return res.status(500).json({ error: "Failed to inspect duplicate phone numbers" });
  }
});

router.post("/admin/phone-duplicates/resolve", verifyToken, isAdmin, async (req, res) => {
  const { apply = false } = req.body || {};
  const client = await pool.connect();

  try {
    await ensureWalletTables();

    const usersWithPhone = await client.query(`
      SELECT id, phone
      FROM users
      WHERE phone IS NOT NULL
        AND TRIM(phone) <> ''
    `);

    const grouped = new Map();
    for (const row of usersWithPhone.rows) {
      const canonical = canonicalPhone(row.phone);
      if (!canonical) {
        continue;
      }

      const current = grouped.get(canonical) || [];
      current.push(Number(row.id));
      grouped.set(canonical, current);
    }

    const duplicateGroups = Array.from(grouped.entries())
      .filter(([, ids]) => ids.length > 1)
      .map(([phone, ids]) => {
        const userIds = ids.sort((a, b) => a - b);
      return {
        phone,
        keep_user_id: userIds[0],
        clear_user_ids: userIds.slice(1),
      };
    });

    if (!apply) {
      return res.json({
        success: true,
        mode: "dry-run",
        duplicate_groups: duplicateGroups.length,
        plan: duplicateGroups,
      });
    }

    await client.query("BEGIN");

    let clearedUsers = 0;
    for (const group of duplicateGroups) {
      if (group.clear_user_ids.length === 0) {
        continue;
      }

      await client.query(
        `UPDATE users
         SET phone = NULL
         WHERE id = ANY($1::int[])`,
        [group.clear_user_ids]
      );

      await client.query(
        `UPDATE wallet_virtual_accounts
         SET wallet_number = NULL
         WHERE user_id = ANY($1::int[])`,
        [group.clear_user_ids]
      );

      clearedUsers += group.clear_user_ids.length;
    }

    await client
      .query(`ALTER TABLE users ADD CONSTRAINT users_phone_unique UNIQUE (phone)`)
      .catch((error) => {
        if (error.code !== "42710") {
          throw error;
        }
      });

    await client.query("COMMIT");

    return res.json({
      success: true,
      mode: "applied",
      duplicate_groups_resolved: duplicateGroups.length,
      cleared_users: clearedUsers,
      message: "Duplicate phone numbers resolved and uniqueness enforced.",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PHONE DUPLICATE RESOLVE ERROR:", err);
    return res.status(500).json({ error: "Failed to resolve duplicate phone numbers" });
  } finally {
    client.release();
  }
});

router.get("/admin/phone-cleanup-report", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensureWalletTables();

    const affected = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        va.id AS virtual_account_id,
        va.wallet_number,
        va.account_number,
        va.bank_name
      FROM users u
      LEFT JOIN wallet_virtual_accounts va ON va.user_id = u.id
      WHERE u.phone IS NULL
         OR TRIM(u.phone) = ''
      ORDER BY u.id ASC
    `);

    return res.json({
      affected_users_count: affected.rowCount,
      affected_users: affected.rows,
    });
  } catch (err) {
    console.error("PHONE CLEANUP REPORT ERROR:", err);
    return res.status(500).json({ error: "Failed to load phone cleanup report" });
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

router.post("/:userId/withdraw", verifyToken, async (req, res) => {
  const amount = parseAmount(req.body.amount);
  const { pin } = req.body;

  if (String(req.user.id) !== String(req.params.userId) && !req.user.is_admin) {
    return res.status(403).json({ error: "Not allowed" });
  }

  if (!amount) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }

  if (!pin) {
    return res.status(400).json({
      error: "Wallet PIN is required.",
    });
  }

  const validPin = await verifyWalletPin(req.params.userId, pin);

  if (!validPin) {
    return res.status(401).json({
      error: "Invalid Wallet PIN.",
    });
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

router.post("/:userId/transfer", verifyToken, async (req, res) => {
  const amount = parseAmount(req.body.amount);
  const recipientPhone = normalizePhone(req.body.recipient_phone);
  const recipientCanonical = canonicalPhone(req.body.recipient_phone);
  const { pin } = req.body;

  if (String(req.user.id) !== String(req.params.userId) && !req.user.is_admin) {
    return res.status(403).json({ error: "Not allowed" });
  }

  if (!amount) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }

  if (!pin) {
    return res.status(400).json({
      error: "Wallet PIN is required.",
    });
  }

  const validPin = await verifyWalletPin(req.params.userId, pin);

  if (!validPin) {
    return res.status(401).json({
      error: "Invalid Wallet PIN.",
    });
  }

  if (!recipientPhone) {
    return res.status(400).json({ error: "Recipient phone is required" });
  }

  if (!recipientCanonical) {
    return res.status(400).json({ error: "Recipient phone is invalid" });
  }

  const client = await pool.connect();

  try {
    await ensureWalletTables();
    await client.query("BEGIN");

    const usersWithPhone = await client.query(
      `SELECT id, name, email, phone
       FROM users
       WHERE phone IS NOT NULL
         AND TRIM(phone) <> ''`
    );

    const matches = usersWithPhone.rows.filter(
      (row) => canonicalPhone(row.phone) === recipientCanonical
    );

    if (matches.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Recipient not found" });
    }

    if (matches.length > 1) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Recipient phone is duplicated. Contact support/admin to resolve phone duplicates.",
      });
    }

    const recipientUser = matches[0];
    const recipientDisplayPhone = normalizePhone(recipientUser.phone) || recipientPhone;

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
      note: `Transfer to ${recipientDisplayPhone}`,
    });

    await insertTransaction(client, {
      userId: recipientUser.id,
      relatedUserId: req.params.userId,
      type: "transfer_in",
      direction: "credit",
      amount,
      note: `Wallet transfer from ${normalizePhone(req.user.phone) || "unknown"}`,
    });
    const senderBalance = balance - amount;

    await createWalletAlert({
      userId: req.params.userId,
      direction: "debit",
      amount,
      balance: senderBalance,
      note: `Transfer to ${recipientDisplayPhone}`,
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
  verifyWalletPin,
};
