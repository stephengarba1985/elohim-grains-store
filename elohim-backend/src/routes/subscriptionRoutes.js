const express = require("express");
const pool = require("../config/db");
const sendWhatsApp = require("../utils/sendWhatsApp");

const router = express.Router();
let schemaInitPromise;

const ensureSubscriptionSchema = async () => {
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
          quantity INTEGER NOT NULL DEFAULT 1,
          plan VARCHAR(20) NOT NULL,
          next_delivery TIMESTAMP NOT NULL,
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT FALSE
      `);
    })().catch((err) => {
      schemaInitPromise = null;
      throw err;
    });
  }

  return schemaInitPromise;
};

router.use(async (req, res, next) => {
  try {
    await ensureSubscriptionSchema();
    next();
  } catch (err) {
    console.error("SUBSCRIPTION SCHEMA ERROR:", err);
    res.status(500).json({
      error: "Subscription setup failed",
      detail: err.message,
    });
  }
});

/* =========================
   CREATE SUBSCRIPTION + INSTANT ORDER
========================= */
router.post("/", async (req, res) => {
  const { user_id, product_id, quantity, plan } = req.body;
  const parsedUserId = Number(user_id);
  const parsedProductId = Number(product_id);
  const parsedQuantity = Number(quantity);
  const normalizedPlan = typeof plan === "string" ? plan.toLowerCase() : "";

  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    return res.status(400).json({ error: "Valid user_id is required" });
  }

  if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
    return res.status(400).json({ error: "Valid product_id is required" });
  }

  if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
    return res.status(400).json({ error: "Quantity must be greater than 0" });
  }

  if (!["weekly", "monthly"].includes(normalizedPlan)) {
    return res.status(400).json({ error: "Plan must be weekly or monthly" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userRes = await client.query(
      "SELECT id FROM users WHERE id = $1",
      [parsedUserId]
    );

    if (userRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }

    const productRes = await client.query(
      "SELECT id, price FROM products WHERE id = $1",
      [parsedProductId]
    );

    if (productRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Product not found" });
    }

    const price = Number(productRes.rows[0].price || 0);

    if (price <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Product price is invalid" });
    }

    const subRes = await client.query(
      `INSERT INTO subscriptions
       (user_id, product_id, quantity, plan, next_delivery, status)
       VALUES (
         $1,
         $2,
         $3,
         $4::varchar,
         NOW() + CASE
           WHEN $4::text = 'weekly' THEN INTERVAL '7 days'
           ELSE INTERVAL '30 days'
         END,
         'active'
       )
       RETURNING *`,
      [parsedUserId, parsedProductId, parsedQuantity, normalizedPlan]
    );

    const subscription = subRes.rows[0];

    const orderRes = await client.query(
      `INSERT INTO orders (user_id, status, total_amount, is_subscription)
       VALUES ($1, 'Processing', $2, true)
       RETURNING id`,
      [parsedUserId, price * parsedQuantity]
    );

    const orderId = orderRes.rows[0].id;

    /* =========================
       AUTO ASSIGN RIDER
    ========================= */
    const riderRes = await client.query(`
      SELECT id
      FROM riders
      WHERE status = 'available'
      ORDER BY current_orders ASC
      LIMIT 1
    `);

    if (riderRes.rows.length > 0) {
      const riderId = riderRes.rows[0].id;

      await client.query(
        "UPDATE orders SET rider_id = $1 WHERE id = $2",
        [riderId, orderId]
      );

      await client.query(
        `UPDATE riders
         SET current_orders = current_orders + 1
         WHERE id = $1`,
        [riderId]
      );

      console.log("Rider auto-assigned:", riderId);
    }

    /* =========================
       SEND WHATSAPP
    ========================= */
    const customerRes = await client.query(
      "SELECT phone, name FROM users WHERE id = $1",
      [parsedUserId]
    );

    const phone = customerRes.rows[0]?.phone;
    const name = customerRes.rows[0]?.name || "Customer";

    if (phone) {
      const message = `Hello ${name},

Your subscription order has been created successfully 🛒

Order ID: ${orderId}
Amount: ₦${price * parsedQuantity}

We will deliver soon 🚚

Elohim Grains 🌾`;

      sendWhatsApp(phone, message);
    }

    await client.query(
      `INSERT INTO order_items (order_id, product_id, quantity, price)
       VALUES ($1, $2, $3, $4)`,
      [orderId, parsedProductId, parsedQuantity, price]
    );

    await client.query("COMMIT");

    res.status(201).json({
      subscription,
      orderId,
      message: "Subscription + Order created successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");

    console.error("SUBSCRIPTION ERROR:", err);

    res.status(500).json({
      error: err.message || "Failed to create subscription",
    });
  } finally {
    client.release();
  }
});

/* =========================
   GET USER SUBSCRIPTIONS
========================= */
router.get("/:userId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, p.name AS product_name
       FROM subscriptions s
       JOIN products p ON s.product_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [req.params.userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("FETCH SUB ERROR:", err);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

/* =========================
   DELETE SUBSCRIPTION
========================= */
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM subscriptions WHERE id = $1", [req.params.id]);

    res.json({ message: "Subscription deleted" });
  } catch (err) {
    console.error("DELETE SUB ERROR:", err);
    res.status(500).json({ error: "Failed to delete subscription" });
  }
});

/* =========================
   PAUSE
========================= */
router.put("/:id/pause", async (req, res) => {
  try {
    await pool.query(
      "UPDATE subscriptions SET status = 'paused' WHERE id = $1",
      [req.params.id]
    );

    res.json({ message: "Subscription paused" });
  } catch (err) {
    console.error("PAUSE ERROR:", err);
    res.status(500).json({ error: "Failed to pause subscription" });
  }
});

/* =========================
   RESUME
========================= */
router.put("/:id/resume", async (req, res) => {
  try {
    await pool.query(
      "UPDATE subscriptions SET status = 'active' WHERE id = $1",
      [req.params.id]
    );

    res.json({ message: "Subscription resumed" });
  } catch (err) {
    console.error("RESUME ERROR:", err);
    res.status(500).json({ error: "Failed to resume subscription" });
  }
});

/* =========================
   SKIP NEXT DELIVERY
========================= */
router.put("/:id/skip", async (req, res) => {
  try {
    const subRes = await pool.query(
      "SELECT plan FROM subscriptions WHERE id = $1",
      [req.params.id]
    );

    if (subRes.rows.length === 0) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const plan = subRes.rows[0].plan;
    const interval = plan === "weekly" ? "7 days" : "30 days";

    await pool.query(
      `UPDATE subscriptions
       SET next_delivery = next_delivery + INTERVAL '${interval}'
       WHERE id = $1`,
      [req.params.id]
    );

    res.json({ message: "Next delivery skipped" });
  } catch (err) {
    console.error("SKIP ERROR:", err);
    res.status(500).json({ error: "Failed to skip delivery" });
  }
});

module.exports = router;
