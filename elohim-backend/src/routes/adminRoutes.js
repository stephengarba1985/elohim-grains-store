const express = require("express");
const pool = require("../config/db");

const router = express.Router();

router.get("/stats", async (req, res) => {
  try {
    const revenue = await pool.query(
      "SELECT SUM(total_amount) FROM orders"
    );

    const orders = await pool.query(
      "SELECT COUNT(*) FROM orders"
    );

    const subscriptions = await pool.query(
      "SELECT COUNT(*) FROM subscriptions WHERE status = 'active'"
    );

    const users = await pool.query(
      "SELECT COUNT(*) FROM users"
    );

    res.json({
      revenue: revenue.rows[0].sum || 0,
      orders: orders.rows[0].count,
      subscriptions: subscriptions.rows[0].count,
      users: users.rows[0].count,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

module.exports = router;