const express = require("express");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth");

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
        ) AS total_spent

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