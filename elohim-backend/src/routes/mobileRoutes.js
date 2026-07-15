const express = require("express");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

const VALID_PLATFORMS = ["android", "ios", "web"];
const VALID_NOTIFICATION_TYPES = [
  "push",
  "wallet_alert",
  "payment_reminder",
  "order_update",
  "general",
];

const ensureMobileTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mobile_devices (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      platform VARCHAR(20) NOT NULL,
      push_token TEXT NOT NULL,
      app_version VARCHAR(50),
      device_name VARCHAR(120),
      status VARCHAR(30) DEFAULT 'active',
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, push_token)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mobile_notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(40) NOT NULL DEFAULT 'general',
      title VARCHAR(160) NOT NULL,
      body TEXT NOT NULL,
      data JSONB,
      status VARCHAR(30) DEFAULT 'queued',
      read_at TIMESTAMP,
      sent_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const normalizePlatform = (platform) => {
  const value = String(platform || "").trim().toLowerCase();
  return VALID_PLATFORMS.includes(value) ? value : null;
};

const normalizeType = (type) => {
  const value = String(type || "general").trim().toLowerCase();
  return VALID_NOTIFICATION_TYPES.includes(value) ? value : "general";
};

const queueMobileNotification = async ({
  userId,
  type = "general",
  title,
  body,
  data = {},
  client = pool,
}) => {
  if (!userId || !title || !body) return null;

  await ensureMobileTables();

  const result = await client.query(
    `INSERT INTO mobile_notifications
      (user_id, type, title, body, data, status)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      userId,
      normalizeType(type),
      title,
      body,
      JSON.stringify(data || {}),
      "queued",
    ]
  );

  return result.rows[0];
};

const createWalletAlert = async ({
  userId,
  direction,
  amount,
  balance = null,
  note = "",
  client = pool,
}) => {
  const isCredit = direction === "credit";
  const title = isCredit ? "Wallet credited" : "Wallet debited";
  const amountText = `NGN ${Number(amount || 0).toLocaleString()}`;
  const body = balance == null
    ? `${amountText} ${isCredit ? "was added to" : "left"} your wallet.`
    : `${amountText} ${isCredit ? "was added to" : "left"} your wallet. Balance: NGN ${Number(balance || 0).toLocaleString()}.`;

  return queueMobileNotification({
    userId,
    type: "wallet_alert",
    title,
    body,
    data: { direction, amount, balance, note },
    client,
  });
};

const createPaymentReminder = async ({
  userId,
  title = "Payment reminder",
  body,
  data = {},
  client = pool,
}) => {
  return queueMobileNotification({
    userId,
    type: "payment_reminder",
    title,
    body,
    data,
    client,
  });
};

router.post("/devices", verifyToken, async (req, res) => {
  try {
    await ensureMobileTables();

    const platform = normalizePlatform(req.body.platform);
    const pushToken = String(req.body.push_token || "").trim();

    if (!platform || !pushToken) {
      return res.status(400).json({
        error: "Valid platform and push_token are required",
      });
    }

    const result = await pool.query(
      `INSERT INTO mobile_devices
        (user_id, platform, push_token, app_version, device_name, status, last_seen)
       VALUES ($1,$2,$3,$4,$5,'active',NOW())
       ON CONFLICT (user_id, push_token) DO UPDATE
         SET platform=EXCLUDED.platform,
             app_version=EXCLUDED.app_version,
             device_name=EXCLUDED.device_name,
             status='active',
             last_seen=NOW()
       RETURNING *`,
      [
        req.user.id,
        platform,
        pushToken,
        req.body.app_version || null,
        req.body.device_name || null,
      ]
    );

    res.json({
      message: "Mobile device registered",
      device: result.rows[0],
      push_provider: process.env.FCM_SERVER_KEY || process.env.EXPO_ACCESS_TOKEN
        ? "configured"
        : "pending_provider_key",
    });
  } catch (err) {
    console.error("MOBILE DEVICE ERROR:", err);
    res.status(500).json({ error: "Failed to register mobile device" });
  }
});

router.get("/notifications", verifyToken, async (req, res) => {
  try {
    await ensureMobileTables();

    const result = await pool.query(
      `SELECT *
       FROM mobile_notifications
       WHERE user_id=$1
       ORDER BY created_at DESC, id DESC
       LIMIT 80`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("MOBILE NOTIFICATIONS ERROR:", err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

router.patch("/notifications/:id/read", verifyToken, async (req, res) => {
  try {
    await ensureMobileTables();

    const result = await pool.query(
      `UPDATE mobile_notifications
       SET read_at=COALESCE(read_at, NOW()),
           status='read'
       WHERE id=$1 AND user_id=$2
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("READ NOTIFICATION ERROR:", err);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

router.post("/test-alert", verifyToken, async (req, res) => {
  try {
    const notification = await queueMobileNotification({
      userId: req.user.id,
      type: "push",
      title: req.body.title || "Elohim mobile alert",
      body: req.body.body || "Your mobile notification channel is ready.",
      data: { test: true },
    });

    res.json({
      message: "Test alert queued",
      notification,
    });
  } catch (err) {
    console.error("TEST ALERT ERROR:", err);
    res.status(500).json({ error: "Failed to queue test alert" });
  }
});

router.post("/payment-reminders/run", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensureMobileTables();

    const pendingPayments = await pool.query(`
      SELECT id, user_id, reference, amount, provider, channel
      FROM payment_transactions
      WHERE status='pending'
        AND user_id IS NOT NULL
        AND created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 50
    `);

    const activePlans = await pool.query(`
      SELECT gp.id, gp.user_id, gp.total_amount, gp.amount_paid, p.name AS product_name
      FROM grain_plans gp
      LEFT JOIN products p ON p.id = gp.product_id
      WHERE COALESCE(gp.status, 'active') = 'active'
        AND COALESCE(gp.total_amount, 0) > COALESCE(gp.amount_paid, 0)
      ORDER BY gp.id DESC
      LIMIT 50
    `);

    const reminders = [];

    for (const payment of pendingPayments.rows) {
      const reminder = await createPaymentReminder({
        userId: payment.user_id,
        body: `Complete your ${payment.provider} payment of NGN ${Number(payment.amount || 0).toLocaleString()} for reference ${payment.reference}.`,
        data: {
          payment_transaction_id: payment.id,
          reference: payment.reference,
          channel: payment.channel,
        },
      });

      if (reminder) reminders.push(reminder);
    }

    for (const plan of activePlans.rows) {
      const remaining = Number(plan.total_amount || 0) - Number(plan.amount_paid || 0);
      const reminder = await createPaymentReminder({
        userId: plan.user_id,
        title: "Grain savings reminder",
        body: `Keep your ${plan.product_name || "grain"} plan moving. Remaining balance: NGN ${remaining.toLocaleString()}.`,
        data: {
          grain_plan_id: plan.id,
          remaining,
        },
      });

      if (reminder) reminders.push(reminder);
    }

    res.json({
      message: "Payment reminders queued",
      count: reminders.length,
      reminders,
    });
  } catch (err) {
    console.error("PAYMENT REMINDER ERROR:", err);
    res.status(500).json({ error: "Failed to queue payment reminders" });
  }
});

router.get("/admin/overview", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensureMobileTables();

    const devices = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE platform='android')::int AS android,
        COUNT(*) FILTER (WHERE platform='ios')::int AS ios,
        COUNT(*) FILTER (WHERE status='active')::int AS active
      FROM mobile_devices
    `);

    const notifications = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread,
        COUNT(*) FILTER (WHERE type='wallet_alert')::int AS wallet_alerts,
        COUNT(*) FILTER (WHERE type='payment_reminder')::int AS payment_reminders
      FROM mobile_notifications
    `);

    const recent = await pool.query(`
      SELECT mn.*, u.name AS user_name, u.email AS user_email
      FROM mobile_notifications mn
      LEFT JOIN users u ON u.id = mn.user_id
      ORDER BY mn.created_at DESC, mn.id DESC
      LIMIT 40
    `);

    res.json({
      devices: devices.rows[0],
      notifications: notifications.rows[0],
      recent: recent.rows,
      native_apps: {
        android: "future",
        ios: "future",
        push_provider: process.env.FCM_SERVER_KEY || process.env.EXPO_ACCESS_TOKEN
          ? "configured"
          : "pending_provider_key",
      },
    });
  } catch (err) {
    console.error("MOBILE ADMIN ERROR:", err);
    res.status(500).json({ error: "Failed to load mobile overview" });
  }
});

module.exports = {
  router,
  ensureMobileTables,
  queueMobileNotification,
  createWalletAlert,
  createPaymentReminder,
};
