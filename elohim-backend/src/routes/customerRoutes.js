const express = require("express");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth");
const { ensureWalletTables, getWalletBalance } = require("./walletRoutes");

const router = express.Router();

/* =========================
   CUSTOMER STATISTICS
========================= */
router.get("/stats", verifyToken, isAdmin, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*)::int AS total_customers,
        COUNT(*) FILTER (WHERE is_admin = false)::int AS customers
      FROM users
    `);

    res.json(stats.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load customer stats" });
  }
});

/* =========================
   ALL CUSTOMERS
========================= */
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        u.address,
        u.created_at,

        COUNT(o.id)::int AS total_orders,

        COALESCE(
          SUM(o.total_amount),
          0
        ) AS total_spent,

        MAX(o.created_at) AS last_purchase

      FROM users u

      LEFT JOIN orders o
      ON o.user_id = u.id

      WHERE COALESCE(u.is_admin,false)=false

      GROUP BY u.id

      ORDER BY u.created_at DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to load customers",
    });
  }
});

/* =========================
   CUSTOMER ORDERS
========================= */

router.get("/:id/orders", verifyToken, isAdmin, async (req, res) => {

  try {

    const result = await pool.query(
      `
      SELECT *

      FROM orders

      WHERE user_id=$1

      ORDER BY created_at DESC
      `,
      [req.params.id]
    );

    res.json(result.rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Failed to load orders",
    });

  }

});

/* Complete customer operating profile for admin follow-up. */
router.get("/:id/profile", verifyToken, isAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const customer = await pool.query(`
      SELECT u.id, u.name, u.email, u.phone, u.address, u.created_at,
        COUNT(o.id)::int AS total_orders,
        COALESCE(SUM(o.total_amount) FILTER (WHERE o.payment_status IN ('paid','verified') OR o.status IN ('paid','delivered')), 0) AS total_spent,
        MAX(o.created_at) AS last_purchase
      FROM users u LEFT JOIN orders o ON o.user_id = u.id
      WHERE u.id=$1 AND COALESCE(u.is_admin,false)=false GROUP BY u.id`, [userId]);
    if (!customer.rows[0]) return res.status(404).json({ error: "Customer not found" });
    await ensureWalletTables();
    const wallet = await getWalletBalance(userId);
    const tableExists = async (name) => Boolean((await pool.query("SELECT to_regclass($1) AS value", [name])).rows[0].value);
    const [hasPlans, hasSubscriptions, hasBulk, hasBnpl] = await Promise.all([
      tableExists("public.grain_plans"), tableExists("public.subscriptions"), tableExists("public.bulk_requests"), tableExists("public.bnpl_applications"),
    ]);
    const [plans, subscriptions, bulk, bnpl] = await Promise.all([
      hasPlans ? pool.query("SELECT COALESCE(SUM(amount_paid),0) AS savings, COUNT(*) FILTER (WHERE status='active')::int AS active FROM grain_plans WHERE user_id=$1", [userId]) : { rows: [{ savings: 0, active: 0 }] },
      hasSubscriptions ? pool.query("SELECT COUNT(*) FILTER (WHERE status='active')::int AS active FROM subscriptions WHERE user_id=$1", [userId]) : { rows: [{ active: 0 }] },
      hasBulk ? pool.query("SELECT COUNT(*)::int AS total FROM bulk_requests WHERE user_id=$1", [userId]) : { rows: [{ total: 0 }] },
      hasBnpl ? pool.query("SELECT status FROM bnpl_applications WHERE user_id=$1 ORDER BY id DESC LIMIT 1", [userId]) : { rows: [] },
    ]);
    const details = customer.rows[0];
    const orders = Number(details.total_orders || 0);
    const spent = Number(details.total_spent || 0);
    const segment = orders === 0 ? "New" : Number(bulk.rows[0].total) > 0 ? "Bulk" : Number(subscriptions.rows[0].active) > 0 ? "Subscription" : spent >= 500000 ? "High Value" : orders > 1 ? "Returning" : "New";
    res.json({ ...details, wallet, savings: Number(plans.rows[0].savings || 0), active_plans: Number(plans.rows[0].active || 0), active_subscriptions: Number(subscriptions.rows[0].active || 0), bulk_customer: Number(bulk.rows[0].total) > 0, bnpl_status: bnpl.rows[0]?.status || "Not assessed", segment });
  } catch (err) {
    console.error("CUSTOMER PROFILE ERROR:", err);
    res.status(500).json({ error: "Failed to load customer profile" });
  }
});

/* =========================
   DELETE CUSTOMER
========================= */

router.delete("/:id", verifyToken, isAdmin, async (req, res) => {

  try {

    await pool.query(
      "DELETE FROM users WHERE id=$1",
      [req.params.id]
    );

    res.json({
      success: true,
      message: "Customer deleted",
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Delete failed",
    });

  }

});

module.exports = router;
