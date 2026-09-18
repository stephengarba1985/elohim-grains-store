const express = require("express");
const pool = require("../config/db");
const { ensureWalletTables } = require("./walletRoutes");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/stats", async (req, res) => {
  try {
    const paymentStatusColumnRes = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'orders'
        AND column_name = 'payment_status'
    `);

    const hasPaymentStatusColumn = paymentStatusColumnRes.rows.length > 0;
    const realizedRevenueFilter = hasPaymentStatusColumn
      ? "(status IN ('paid', 'delivered') OR payment_status = 'verified')"
      : "status IN ('paid', 'delivered')";

    const [
      revenue,
      todayRevenue,
      orders,
      todayOrders,
      customers,
      newCustomers,
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
        WHERE ${realizedRevenueFilter}
      `),

      pool.query(`
        SELECT COALESCE(SUM(total_amount),0) AS revenue
        FROM orders
        WHERE DATE(created_at)=CURRENT_DATE
          AND ${realizedRevenueFilter}
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
        FROM users
        WHERE COALESCE(is_admin,false)=false
          AND DATE(created_at)=CURRENT_DATE
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
        FROM (
          SELECT
            p.id,
            GREATEST(
              COALESCE(p.stock_quantity, 0),
              COALESCE(SUM(pv.stock), 0)
            ) AS effective_stock
          FROM products p
          LEFT JOIN product_variants pv ON pv.product_id = p.id
          GROUP BY p.id, p.stock_quantity
        ) stock_view
        WHERE effective_stock > 0 AND effective_stock <= 10
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

      newCustomers: newCustomers.rows[0].total,

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

router.get("/money-overview", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensureWalletTables();
    const tableExists = async (name) => Boolean((await pool.query("SELECT to_regclass($1) AS value", [name])).rows[0].value);
    const [hasPlans, hasBnpl, hasPayments] = await Promise.all([tableExists("public.grain_plans"), tableExists("public.bnpl_agreements"), tableExists("public.payment_transactions")]);
    const [sales, wallet, savings, bnpl, refunds] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total_amount),0) AS value FROM orders WHERE DATE(created_at)=CURRENT_DATE AND (payment_status='verified' OR status IN ('paid','delivered','processing'))`),
      pool.query(`SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount ELSE -amount END),0) AS value FROM wallet_transactions`),
      hasPlans ? pool.query("SELECT COALESCE(SUM(amount_paid),0) AS value FROM grain_plans WHERE status='active'") : { rows: [{ value: 0 }] },
      hasBnpl ? pool.query("SELECT COALESCE(SUM(total_amount-amount_paid),0) AS value FROM bnpl_agreements WHERE status='active'") : { rows: [{ value: 0 }] },
      hasPayments ? pool.query("SELECT COALESCE(SUM(amount),0) AS value FROM payment_transactions WHERE status='pending' AND channel='refund'") : { rows: [{ value: 0 }] },
    ]);
    res.json({ sales_today: sales.rows[0].value, wallet_funds_held: wallet.rows[0].value, savings_funds_held: savings.rows[0].value, outstanding_bnpl: bnpl.rows[0].value, pending_refunds: refunds.rows[0].value });
  } catch (err) { console.error("MONEY OVERVIEW ERROR:", err); res.status(500).json({ error: "Failed to load money overview" }); }
});

module.exports = router;
