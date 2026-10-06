const express = require("express");
const pool = require("../config/db");
const { createPaymentReminder } = require("./mobileRoutes");
const { verifyToken, isAdmin, requirePermission } = require("../middleware/auth");
const { getAuthoritativeCartPricing } = require("../utils/cartPricing");

const router = express.Router();

const OPAY_ACCOUNT = { bank_name: "OPay", account_number: "8148993001", account_name: "Elohim Grains Store" };
const PROVIDERS = { opay: { label: "OPay bank transfer", channels: ["bank_transfer"], bank: "OPay" } };

const ensurePaymentGatewayTables = async () => {
  await pool.query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50),
      ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(50),
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'pending'
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      provider VARCHAR(50) NOT NULL,
      channel VARCHAR(50) NOT NULL,
      reference VARCHAR(100) UNIQUE NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(30) DEFAULT 'pending',
      account_number VARCHAR(30),
      account_name VARCHAR(255),
      bank_name VARCHAR(255),
      ussd_code VARCHAR(100),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      verified_at TIMESTAMP
    )
  `);
};

const createReference = (provider) => {
  const prefix = provider.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
};

router.get("/options", async (req, res) => {
  res.json({
    account: OPAY_ACCOUNT,
    providers: Object.entries(PROVIDERS).map(([value, config]) => ({
      value,
      label: config.label,
      channels: config.channels,
    })),
  });
});

router.get("/admin/overview", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensurePaymentGatewayTables();

    // =========================
    // Recent Transactions
    // =========================
    const transactions = await pool.query(`
      SELECT
        pt.*,
        u.name AS user_name,
        u.email AS user_email
      FROM payment_transactions pt
      LEFT JOIN users u
        ON pt.user_id = u.id
      ORDER BY pt.created_at DESC
      LIMIT 100
    `);

    // =========================
    // Overall Totals
    // =========================
    const totals = await pool.query(`
      SELECT

        COUNT(*)::int AS transactions,

        COUNT(*) FILTER (
          WHERE status='verified'
        )::int AS verified,

        COUNT(*) FILTER (
          WHERE status='pending'
        )::int AS pending,

        COUNT(*) FILTER (
          WHERE status='failed'
        )::int AS failed,

        COALESCE(
          SUM(
            CASE
              WHEN status='verified'
              THEN amount
              ELSE 0
            END
          ),0
        ) AS verified_amount,

        COALESCE(
          SUM(
            CASE
              WHEN status='pending'
              THEN amount
              ELSE 0
            END
          ),0
        ) AS pending_amount

      FROM payment_transactions
    `);

    // =========================
    // Revenue Today
    // =========================
    const revenueToday = await pool.query(`
      SELECT

      COALESCE(
        SUM(amount),
        0
      ) AS revenue_today

      FROM payment_transactions

      WHERE status='verified'

      AND DATE(created_at)=CURRENT_DATE
    `);

    // =========================
    // Revenue This Month
    // =========================
    const revenueMonth = await pool.query(`
      SELECT

      COALESCE(
        SUM(amount),
        0
      ) AS revenue_month

      FROM payment_transactions

      WHERE status='verified'

      AND DATE_TRUNC(
          'month',
          created_at
      )=

      DATE_TRUNC(
          'month',
          CURRENT_DATE
      )
    `);

    res.json({

      totals:{

        ...totals.rows[0],

        revenue_today:
          revenueToday.rows[0].revenue_today,

        revenue_month:
          revenueMonth.rows[0].revenue_month

      },

      transactions:
        transactions.rows

    });

  } catch (err) {
    console.error("PAYMENT ADMIN ERROR:", err);
    res.status(500).json({

      error:
      "Failed to load payment overview"

    });
  }
});

router.post("/initialize", verifyToken, async (req, res) => {
  const { provider, channel } = req.body;
  const user_id = Number(req.user.id);
  const selectedProvider = PROVIDERS[provider];

  if (!user_id || !selectedProvider || !channel) {
    return res.status(400).json({ error: "User, provider, and channel are required" });
  }

  if (!selectedProvider.channels.includes(channel)) {
    return res.status(400).json({ error: "Channel is not supported by selected provider" });
  }

  try {
    await ensurePaymentGatewayTables();

    const cartPricing = await getAuthoritativeCartPricing(pool, user_id);
    const finalAmount = cartPricing.total;

    if (!finalAmount) {
      return res.status(400).json({ error: "Cart is empty or amount is invalid" });
    }

    const reference = createReference(provider);
    const accountNumber = OPAY_ACCOUNT.account_number;
    const ussdCode = null;
    const result = await pool.query(
      `INSERT INTO payment_transactions
        (user_id, provider, channel, reference, amount, account_number, account_name, bank_name, ussd_code, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        user_id,
        provider,
        channel,
        reference,
        finalAmount,
        accountNumber,
        OPAY_ACCOUNT.account_name,
        accountNumber ? selectedProvider.bank : null,
        ussdCode,
        JSON.stringify({
          provider_label: selectedProvider.label,
          manual_confirmation: true,
        }),
      ]
    );
    await createPaymentReminder({
      userId: user_id,
      body: `Complete your ${selectedProvider.label} payment of NGN ${Number(finalAmount || 0).toLocaleString()} using reference ${reference}.`,
      data: {
        payment_transaction_id: result.rows[0].id,
        reference,
        provider,
        channel,
      },
    });

    res.json({
      transaction: result.rows[0],
      authorization_url:
        null,
      access_code:
        null,
      instructions: {
        title: selectedProvider.label,
        reference,
        amount: finalAmount,
        bank_name: accountNumber ? selectedProvider.bank : null,
        account_number: accountNumber,
        account_name: OPAY_ACCOUNT.account_name,
        ussd_code: ussdCode,
        message: "Transfer the exact amount to this OPay account using your reference. Your payment stays pending until an administrator confirms receipt.",
      },
    });
  } catch (err) {
    console.error("PAYMENT INIT ERROR:", err);
    res.status(500).json({ error: "Failed to initialize payment" });
  }
});

router.post("/admin/confirm-transfer", verifyToken, isAdmin, requirePermission("payments"), async (req, res) => {
  const receiptReference = String(req.body.receipt_reference || "").trim();
  if (!req.body.reference || !receiptReference) return res.status(400).json({ error: "Payment reference and bank receipt reference are required" });
  await ensurePaymentGatewayTables();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT * FROM payment_transactions WHERE reference=$1 AND provider='opay' FOR UPDATE", [req.body.reference]);
    const payment = result.rows[0];
    if (!payment || !payment.order_id) { await client.query("ROLLBACK"); return res.status(404).json({ error: "OPay order payment not found" }); }
    if (payment.status === "verified") { await client.query("ROLLBACK"); return res.json({ message: "Already confirmed" }); }
    if (payment.status !== "pending") { await client.query("ROLLBACK"); return res.status(409).json({ error: "Payment is not pending" }); }
    // Serialize confirmations so one bank receipt cannot pay for multiple orders.
    await client.query("SELECT pg_advisory_xact_lock(8148993001::bigint)");
    const duplicate = await client.query("SELECT id FROM payment_transactions WHERE provider='opay' AND status='verified' AND metadata->>'receipt_reference'=$1", [receiptReference]);
    if (duplicate.rows.length) { await client.query("ROLLBACK"); return res.status(409).json({ error: "This bank receipt has already been used" }); }
    const order = await client.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [payment.order_id]);
    if (!order.rows[0] || order.rows[0].status !== "pending" || Math.round(Number(order.rows[0].total_amount)*100) !== Math.round(Number(payment.amount)*100)) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Order is not awaiting this payment" }); }
    await client.query("UPDATE payment_transactions SET status='verified', verified_at=NOW(), metadata=COALESCE(metadata,'{}'::jsonb) || $2::jsonb WHERE id=$1", [payment.id, JSON.stringify({ receipt_reference: receiptReference, confirmed_by: req.user.id })]);
    await client.query("UPDATE orders SET payment_status='verified', status='paid' WHERE id=$1", [payment.order_id]);
    await client.query("COMMIT");
    res.json({ message: "OPay transfer confirmed", order_id: payment.order_id });
  } catch (err) { await client.query("ROLLBACK"); console.error("OPAY CONFIRM ERROR", err); res.status(500).json({ error: "Could not confirm OPay transfer" }); }
  finally { client.release(); }
});

router.post("/verify", verifyToken, async (req, res) => {
  const { reference } = req.body;

  if (!reference) {
    return res.status(400).json({ error: "Reference is required" });
  }

  try {
    await ensurePaymentGatewayTables();

    const existing = await pool.query(
      "SELECT * FROM payment_transactions WHERE reference=$1 AND user_id=$2",
      [reference, req.user.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Payment transaction not found" });
    }

    return res.status(409).json({
      error: "Browser verification cannot mark a payment as successful.",
      reference: existing.rows[0].reference,
      status: existing.rows[0].status,
      next_step: "Await administrator confirmation of your OPay receipt.",
    });
  } catch (err) {
    console.error("PAYMENT VERIFY ERROR:", err);
    res.status(500).json({
      error: "Failed to verify payment",
      detail: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

module.exports = { router, ensurePaymentGatewayTables };
