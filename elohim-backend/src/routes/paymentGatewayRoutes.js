const express = require("express");
const pool = require("../config/db");
const { createPaymentReminder, queueMobileNotification } = require("./mobileRoutes");

const router = express.Router();

const PROVIDERS = {
  paystack: {
    label: "Paystack",
    channels: ["card", "bank_transfer", "ussd"],
    bank: "Paystack-Titan",
    ussd: "*737*50*amount#",
  },
  flutterwave: {
    label: "Flutterwave",
    channels: ["card", "bank_transfer", "ussd"],
    bank: "Flutterwave Sterling",
    ussd: "*566*amount#",
  },
  monnify: {
    label: "Monnify",
    channels: ["virtual_account", "bank_transfer"],
    bank: "Moniepoint MFB",
    ussd: null,
  },
  opay: {
    label: "Opay Transfer",
    channels: ["opay_transfer", "bank_transfer"],
    bank: "OPay Digital Services",
    ussd: "*955#",
  },
};

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

const parseAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
};

const createReference = (provider) => {
  const prefix = provider.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
};

const createVirtualAccount = ({ provider, userId }) => {
  const seed = String(userId || "0").padStart(4, "0").slice(-4);
  const suffix = String(Date.now()).slice(-6);
  const providerCode = provider === "opay" ? "81" : provider === "monnify" ? "55" : "70";
  return `${providerCode}${seed}${suffix}`.slice(0, 10);
};

const getCartTotal = async (userId) => {
  const result = await pool.query(
    `SELECT
      cart.quantity,
      COALESCE(product_variants.price, products.price) AS price
     FROM cart
     JOIN products ON cart.product_id = products.id
     LEFT JOIN product_variants ON cart.variant_id = product_variants.id
     WHERE cart.user_id=$1`,
    [userId]
  );

  return result.rows.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
};

router.get("/options", async (req, res) => {
  res.json({
    providers: Object.entries(PROVIDERS).map(([value, config]) => ({
      value,
      label: config.label,
      channels: config.channels,
    })),
  });
});

router.get("/admin/overview", async (req, res) => {
  try {
    await ensurePaymentGatewayTables();

    const transactions = await pool.query(`
      SELECT pt.*, u.name AS user_name, u.email AS user_email
      FROM payment_transactions pt
      LEFT JOIN users u ON pt.user_id = u.id
      ORDER BY pt.id DESC
      LIMIT 100
    `);

    const totals = await pool.query(`
      SELECT
        COUNT(*)::int AS transactions,
        COUNT(*) FILTER (WHERE status='verified')::int AS verified,
        COUNT(*) FILTER (WHERE status='pending')::int AS pending,
        COALESCE(SUM(CASE WHEN status='verified' THEN amount ELSE 0 END), 0) AS verified_amount,
        COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END), 0) AS pending_amount
      FROM payment_transactions
    `);

    res.json({ totals: totals.rows[0], transactions: transactions.rows });
  } catch (err) {
    console.error("PAYMENT ADMIN ERROR:", err);
    res.status(500).json({ error: "Failed to load payment gateway overview" });
  }
});

router.post("/initialize", async (req, res) => {
  const { user_id, provider, channel, amount } = req.body;
  const selectedProvider = PROVIDERS[provider];
  const parsedAmount = parseAmount(amount);

  if (!user_id || !selectedProvider || !channel) {
    return res.status(400).json({ error: "User, provider, and channel are required" });
  }

  if (!selectedProvider.channels.includes(channel)) {
    return res.status(400).json({ error: "Channel is not supported by selected provider" });
  }

  try {
    await ensurePaymentGatewayTables();

    const cartTotal = await getCartTotal(user_id);
    const finalAmount = parsedAmount || cartTotal;

    if (!finalAmount) {
      return res.status(400).json({ error: "Cart is empty or amount is invalid" });
    }

    const reference = createReference(provider);
    const isTransfer = ["bank_transfer", "virtual_account", "opay_transfer"].includes(channel);
    const accountNumber = isTransfer ? createVirtualAccount({ provider, userId: user_id }) : null;
    const ussdCode = channel === "ussd" ? selectedProvider.ussd?.replace("amount", String(Math.ceil(finalAmount))) : null;

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
        accountNumber ? `ELOHIM GRAINS/${reference.slice(-8)}` : null,
        accountNumber ? selectedProvider.bank : null,
        ussdCode,
        JSON.stringify({
          provider_label: selectedProvider.label,
          verification_mode: "simulated",
          future_integrations: ["market bank transfer verification", "webhooks", "virtual account callbacks"],
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
      instructions: {
        title: selectedProvider.label,
        reference,
        amount: finalAmount,
        bank_name: accountNumber ? selectedProvider.bank : null,
        account_number: accountNumber,
        account_name: accountNumber ? `ELOHIM GRAINS/${reference.slice(-8)}` : null,
        ussd_code: ussdCode,
        message: accountNumber
          ? "Transfer the exact amount to the virtual account, then verify payment."
          : channel === "ussd"
            ? "Dial the USSD code and complete payment, then verify payment."
            : "Complete payment using the selected gateway, then verify payment.",
      },
    });
  } catch (err) {
    console.error("PAYMENT INIT ERROR:", err);
    res.status(500).json({ error: "Failed to initialize payment" });
  }
});

router.post("/verify", async (req, res) => {
  const { reference } = req.body;

  if (!reference) {
    return res.status(400).json({ error: "Reference is required" });
  }

  try {
    await ensurePaymentGatewayTables();

    const existing = await pool.query(
      "SELECT * FROM payment_transactions WHERE reference=$1",
      [reference]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Payment transaction not found" });
    }

    const result = await pool.query(
      `UPDATE payment_transactions
       SET status='verified', verified_at=COALESCE(verified_at, NOW())
       WHERE reference=$1
       RETURNING *`,
      [reference]
    );
    const transaction = result.rows[0];

    if (transaction.user_id) {
      await queueMobileNotification({
        userId: transaction.user_id,
        type: "payment_reminder",
        title: "Payment verified",
        body: `Your payment of NGN ${Number(transaction.amount || 0).toLocaleString()} has been verified.`,
        data: {
          payment_transaction_id: transaction.id,
          reference: transaction.reference,
          status: transaction.status,
        },
      });
    }

    res.json({
      success: true,
      transaction,
      note: "Simulated verification complete. Replace this with provider webhook/API verification in production.",
    });
  } catch (err) {
    console.error("PAYMENT VERIFY ERROR:", err);
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

module.exports = { router, ensurePaymentGatewayTables };
