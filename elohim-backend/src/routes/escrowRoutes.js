const express = require("express");
const pool = require("../config/db");
const {
  ensureWalletTables,
  getWalletBalance,
  insertTransaction,
} = require("./walletRoutes");

const router = express.Router();

const ensureEscrowTables = async () => {
  await pool.query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS is_escrow BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS escrow_status VARCHAR(30) DEFAULT 'none'
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS escrow_payments (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(30) DEFAULT 'held',
      release_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      released_at TIMESTAMP,
      refunded_at TIMESTAMP
    )
  `);
};

const parseAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
};

router.get("/user/:userId", async (req, res) => {
  try {
    await ensureEscrowTables();

    const result = await pool.query(
      `SELECT ep.*, o.status AS order_status, o.total_amount
       FROM escrow_payments ep
       JOIN orders o ON ep.order_id = o.id
       WHERE ep.user_id=$1
       ORDER BY ep.id DESC`,
      [req.params.userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("ESCROW USER ERROR:", err);
    res.status(500).json({ error: "Failed to load escrow payments" });
  }
});

router.get("/admin/overview", async (req, res) => {
  try {
    await ensureEscrowTables();

    const payments = await pool.query(`
      SELECT ep.*, o.status AS order_status, o.total_amount, u.name AS user_name, u.email AS user_email
      FROM escrow_payments ep
      JOIN orders o ON ep.order_id = o.id
      JOIN users u ON ep.user_id = u.id
      ORDER BY ep.id DESC
    `);

    const totals = await pool.query(`
      SELECT
        COUNT(*)::int AS payments,
        COUNT(*) FILTER (WHERE status='held')::int AS held_count,
        COUNT(*) FILTER (WHERE status='released')::int AS released_count,
        COUNT(*) FILTER (WHERE status='refunded')::int AS refunded_count,
        COALESCE(SUM(CASE WHEN status='held' THEN amount ELSE 0 END), 0) AS held_amount,
        COALESCE(SUM(CASE WHEN status='released' THEN amount ELSE 0 END), 0) AS released_amount,
        COALESCE(SUM(CASE WHEN status='refunded' THEN amount ELSE 0 END), 0) AS refunded_amount
      FROM escrow_payments
    `);

    res.json({ totals: totals.rows[0], payments: payments.rows });
  } catch (err) {
    console.error("ESCROW ADMIN ERROR:", err);
    res.status(500).json({ error: "Failed to load escrow overview" });
  }
});

router.post("/orders/:orderId/hold", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureEscrowTables();
    await ensureWalletTables();
    await client.query("BEGIN");

    const orderRes = await client.query("SELECT * FROM orders WHERE id=$1", [
      req.params.orderId,
    ]);

    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderRes.rows[0];
    const amount = parseAmount(req.body.amount || order.total_amount);

    if (!amount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Valid escrow amount is required" });
    }

    const existing = await client.query(
      "SELECT id FROM escrow_payments WHERE order_id=$1 AND status='held'",
      [req.params.orderId]
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "This order already has funds in escrow" });
    }

    const walletBalance = await getWalletBalance(order.user_id, client);

    if (amount > walletBalance) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient wallet balance for escrow" });
    }

    await insertTransaction(client, {
      userId: order.user_id,
      type: "escrow_hold",
      direction: "debit",
      amount,
      note: `Escrow hold for order #${order.id}`,
    });

    const escrow = await client.query(
      `INSERT INTO escrow_payments (order_id, user_id, amount, status)
       VALUES ($1,$2,$3,'held')
       RETURNING *`,
      [order.id, order.user_id, amount]
    );

    await client.query(
      "UPDATE orders SET is_escrow=TRUE, escrow_status='held', status='escrow_held' WHERE id=$1",
      [order.id]
    );

    await client.query("COMMIT");
    res.json(escrow.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ESCROW HOLD ERROR:", err);
    res.status(500).json({ error: "Failed to hold escrow funds" });
  } finally {
    client.release();
  }
});

router.post("/:id/release", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureEscrowTables();
    await client.query("BEGIN");

    const escrowRes = await client.query("SELECT * FROM escrow_payments WHERE id=$1", [
      req.params.id,
    ]);

    if (escrowRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Escrow payment not found" });
    }

    const escrow = escrowRes.rows[0];

    if (escrow.status !== "held") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Only held escrow can be released" });
    }

    await client.query(
      `UPDATE escrow_payments
       SET status='released', released_at=NOW(), release_note=$1
       WHERE id=$2`,
      [req.body.note || "Delivery confirmed", req.params.id]
    );

    await client.query(
      "UPDATE orders SET escrow_status='released', status='paid' WHERE id=$1",
      [escrow.order_id]
    );

    await client.query("COMMIT");
    res.json({ message: "Escrow released" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ESCROW RELEASE ERROR:", err);
    res.status(500).json({ error: "Failed to release escrow" });
  } finally {
    client.release();
  }
});

router.post("/:id/refund", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureEscrowTables();
    await ensureWalletTables();
    await client.query("BEGIN");

    const escrowRes = await client.query("SELECT * FROM escrow_payments WHERE id=$1", [
      req.params.id,
    ]);

    if (escrowRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Escrow payment not found" });
    }

    const escrow = escrowRes.rows[0];

    if (escrow.status !== "held") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Only held escrow can be refunded" });
    }

    await insertTransaction(client, {
      userId: escrow.user_id,
      type: "escrow_refund",
      direction: "credit",
      amount: escrow.amount,
      note: `Escrow refund for order #${escrow.order_id}`,
    });

    await client.query(
      "UPDATE escrow_payments SET status='refunded', refunded_at=NOW(), release_note=$1 WHERE id=$2",
      [req.body.note || "Escrow refunded", req.params.id]
    );

    await client.query(
      "UPDATE orders SET escrow_status='refunded', status='refunded' WHERE id=$1",
      [escrow.order_id]
    );

    await client.query("COMMIT");
    res.json({ message: "Escrow refunded" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ESCROW REFUND ERROR:", err);
    res.status(500).json({ error: "Failed to refund escrow" });
  } finally {
    client.release();
  }
});

module.exports = { router, ensureEscrowTables };
