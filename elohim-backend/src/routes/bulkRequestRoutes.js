const express = require("express");
const pool = require("../config/db");

const router = express.Router();

/* =========================
   CREATE REQUEST
========================= */
router.post("/", async (req, res) => {
  const { user_id, product_id, quantity, requested_price } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO bulk_requests 
       (user_id, product_id, quantity, requested_price)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user_id, product_id, quantity, requested_price]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create request" });
  }
});

/* =========================
   GET USER REQUESTS
========================= */
router.get("/user/:userId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT br.*, p.name 
       FROM bulk_requests br
       JOIN products p ON br.product_id = p.id
       WHERE br.user_id = $1
       ORDER BY br.created_at DESC`,
      [req.params.userId]
    );

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

/* =========================
   GET ALL (ADMIN)
========================= */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT br.*, u.name as user_name, p.name as product_name
       FROM bulk_requests br
       JOIN users u ON br.user_id = u.id
       JOIN products p ON br.product_id = p.id
       ORDER BY br.created_at DESC`
    );

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

/* =========================
   APPROVE REQUEST → CREATE ORDER 🔥
========================= */
router.put("/:id/approve", async (req, res) => {
  const { approved_price } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // get request
    const reqRes = await client.query(
      "SELECT * FROM bulk_requests WHERE id = $1",
      [req.params.id]
    );

    const request = reqRes.rows[0];

    // update request
    await client.query(
      `UPDATE bulk_requests 
       SET status = 'approved', approved_price = $1
       WHERE id = $2`,
      [approved_price, req.params.id]
    );

    // create order
    const orderRes = await client.query(
      `INSERT INTO orders (user_id, total_amount, is_bulk)
       VALUES ($1, $2, true)
       RETURNING id`,
      [request.user_id, approved_price * request.quantity]
    );

    const orderId = orderRes.rows[0].id;

    // order item
    await client.query(
      `INSERT INTO order_items (order_id, product_id, quantity, price)
       VALUES ($1, $2, $3, $4)`,
      [
        orderId,
        request.product_id,
        request.quantity,
        approved_price,
      ]
    );

    await client.query("COMMIT");

    res.json({ message: "Approved & Order Created", orderId });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Approval failed" });
  } finally {
    client.release();
  }
});

/* =========================
   REJECT
========================= */
router.put("/:id/reject", async (req, res) => {
  try {
    await pool.query(
      `UPDATE bulk_requests SET status = 'rejected' WHERE id = $1`,
      [req.params.id]
    );

    res.json({ message: "Rejected" });

  } catch (err) {
    res.status(500).json({ error: "Reject failed" });
  }
});

module.exports = router;