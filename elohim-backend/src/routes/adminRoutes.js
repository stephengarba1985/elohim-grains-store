const express = require("express");
const pool = require("../config/db");

const router = express.Router();

router.get("/stats", async (req, res) => {
  try {
    const [
      revenue,
      todayRevenue,
      orders,
      todayOrders,
      customers,
      products,
      riders,
      lowStock,
      delivered,
      pending,
      subscriptions,
    ] = await Promise.all([

      pool.query(`
        SELECT COALESCE(SUM(total_amount),0) AS revenue
        FROM orders
      `),

      pool.query(`
        SELECT COALESCE(SUM(total_amount),0) AS revenue
        FROM orders
        WHERE DATE(created_at)=CURRENT_DATE
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM orders
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM orders
        WHERE DATE(created_at)=CURRENT_DATE
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM users
        WHERE COALESCE(is_admin,false)=false
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM products
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM riders
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM products
        WHERE stock_quantity<=10
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM orders
        WHERE status='delivered'
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM orders
        WHERE status!='delivered'
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM subscriptions
        WHERE status='active'
      `),

    ]);

    res.json({

      revenue: revenue.rows[0].revenue,

      todayRevenue: todayRevenue.rows[0].revenue,

      orders: orders.rows[0].total,

      todayOrders: todayOrders.rows[0].total,

      customers: customers.rows[0].total,

      products: products.rows[0].total,

      riders: riders.rows[0].total,

      lowStock: lowStock.rows[0].total,

      delivered: delivered.rows[0].total,

      pending: pending.rows[0].total,

      subscriptions: subscriptions.rows[0].total

    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Failed to load dashboard"
    });

  }
});

module.exports = router;