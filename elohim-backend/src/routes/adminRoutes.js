const express = require("express");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/stats", verifyToken, isAdmin, async (req, res) => {
  try {
    const [
      revenue,
      orders,
      users,
      products,
      riders,
      subscriptions,
      pendingOrders,
      processingOrders,
      deliveredOrders,
      lowStockProducts,
      monthlySales,
    ] = await Promise.all([
      pool.query("SELECT COALESCE(SUM(total_amount),0) AS total FROM orders"),
      pool.query("SELECT COUNT(*) AS total FROM orders"),
      pool.query("SELECT COUNT(*) AS total FROM users"),
      pool.query("SELECT COUNT(*) AS total FROM products"),
      pool.query("SELECT COUNT(*) AS total FROM riders"),
      pool.query("SELECT COUNT(*) AS total FROM subscriptions WHERE status='active'"),
      pool.query("SELECT COUNT(*) AS total FROM orders WHERE status='pending'"),
      pool.query("SELECT COUNT(*) AS total FROM orders WHERE status='processing'"),
      pool.query("SELECT COUNT(*) AS total FROM orders WHERE status='delivered'"),
      pool.query("SELECT COUNT(*) AS total FROM products WHERE stock_quantity <= 10"),
      pool.query(`
        SELECT COALESCE(SUM(total_amount),0) AS total
        FROM orders
        WHERE DATE_TRUNC('month', created_at)=DATE_TRUNC('month', NOW())
      `),
    ]);

    res.json({
      revenue: Number(revenue.rows[0].total),
      orders: Number(orders.rows[0].total),
      users: Number(users.rows[0].total),
      products: Number(products.rows[0].total),
      riders: Number(riders.rows[0].total),
      subscriptions: Number(subscriptions.rows[0].total),
      pendingOrders: Number(pendingOrders.rows[0].total),
      processingOrders: Number(processingOrders.rows[0].total),
      deliveredOrders: Number(deliveredOrders.rows[0].total),
      lowStockProducts: Number(lowStockProducts.rows[0].total),
      monthlySales: Number(monthlySales.rows[0].total),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to load dashboard statistics",
    });
  }
});

module.exports = router;