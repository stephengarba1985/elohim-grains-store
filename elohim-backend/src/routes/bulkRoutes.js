const express = require("express");
const pool = require("../config/db");

const router = express.Router();

/* =========================
   CREATE BULK REQUEST
========================= */
router.post("/", async (req, res) => {
  const { user_id, product_id, quantity, requested_price } = req.body;

  // ✅ VALIDATION (prevents crash)
  if (!user_id || !product_id || !quantity || !requested_price) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO bulk_requests 
       (user_id, product_id, quantity, requested_price, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [user_id, product_id, quantity, requested_price]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error("❌ BULK CREATE ERROR:", err.message);
    res.status(500).json({ error: "Failed to create bulk request" });
  }
});

/* =========================
   GET ALL BULK REQUESTS (ADMIN)
========================= */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.*,
        p.name AS product_name,
        u.name AS user_name
      FROM bulk_requests b
      LEFT JOIN products p ON b.product_id = p.id
      LEFT JOIN users u ON b.user_id = u.id
      ORDER BY b.id DESC
    `);

    // ✅ DEBUG LOG (important for your issue)
    console.log("📦 BULK REQUESTS:", result.rows);

    res.json(result.rows);

  } catch (err) {
    console.error("❌ BULK FETCH ERROR:", err);
    res.status(500).json({ error: "Failed to fetch bulk requests" });
  }
});

/* =========================
   UPDATE BULK STATUS (ADMIN APPROVAL)
========================= */
router.put("/:id", async (req, res) => {
  const { status, approved_price } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  try {
    await pool.query(
      `UPDATE bulk_requests
       SET status = $1, approved_price = $2
       WHERE id = $3`,
      [status, approved_price || null, req.params.id]
    );

    res.json({ message: "Bulk request updated" });

  } catch (err) {
    console.error("❌ BULK UPDATE ERROR:", err.message);
    res.status(500).json({ error: "Update failed" });
  }
});

/* =========================
   ACCEPT DEAL → CREATE ORDER (CORE FLOW)
========================= */
router.post("/:id/accept", async (req, res) => {
  const client = await pool.connect();

  try {
    const id = req.params.id;

    console.log("🔍 ACCEPT DEAL - ID:", id);

    await client.query("BEGIN");

    /* =========================
       GET BULK REQUEST
    ========================= */
    const bulkRes = await client.query(
      "SELECT * FROM bulk_requests WHERE id = $1",
      [id]
    );

    const bulk = bulkRes.rows[0];
    console.log("🔍 BULK REQUEST:", bulk);

    if (!bulk || bulk.status !== "approved") {
      throw new Error("Deal not approved");
    }

    /* =========================
       CREATE ORDER
    ========================= */
    const orderRes = await client.query(
      `INSERT INTO orders (user_id, total_amount, status, is_bulk)
       VALUES ($1, $2, 'pending', true)
       RETURNING id`,
      [
        bulk.user_id,
        bulk.approved_price * bulk.quantity,
      ]
    );

    const orderId = orderRes.rows[0].id;
    console.log("🔍 ORDER CREATED:", orderId);

    /* =========================
       CREATE ORDER ITEM
    ========================= */
    await client.query(
      `INSERT INTO order_items (order_id, product_id, quantity, price)
       VALUES ($1, $2, $3, $4)`,
      [
        orderId,
        bulk.product_id,
        bulk.quantity,
        bulk.approved_price,
      ]
    );

    /* =========================
       UPDATE BULK STATUS
    ========================= */
    await client.query(
      `UPDATE bulk_requests
       SET status = 'accepted'
       WHERE id = $1`,
      [id]
    );

    await client.query("COMMIT");

    res.json({
      message: "Order created",
      orderId,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ ACCEPT DEAL ERROR:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;