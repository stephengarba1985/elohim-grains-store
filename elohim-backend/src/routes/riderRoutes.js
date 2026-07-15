const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {
  ensureDeliveryTrackingTables,
  addDeliveryEvent,
} = require("./trackingRoutes");

/* =========================
   CREATE RIDER
========================= */
router.post("/", async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    const result = await pool.query(
      `INSERT INTO riders (name, phone, status)
       VALUES ($1, $2, 'available')
       RETURNING *`,
      [name, phone]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create rider" });
  }
});

/* =========================
   DELETE RIDER
========================= */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const assignedOrderRes = await pool.query(
      `SELECT id
       FROM orders
       WHERE rider_id = $1
         AND status IN ('assigned', 'in_transit', 'processing')
       LIMIT 1`,
      [id]
    );

    if (assignedOrderRes.rows.length > 0) {
      return res.status(400).json({
        error: "Rider is assigned to an active order and cannot be deleted",
      });
    }

    const result = await pool.query(
      `DELETE FROM riders
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Rider not found" });
    }

    await pool.query(
      `UPDATE orders
       SET rider_id = NULL
       WHERE rider_id = $1`,
      [id]
    );

    res.json({ message: "Rider deleted successfully", rider: result.rows[0] });
  } catch (err) {
    console.error("DELETE RIDER ERROR:", err);
    res.status(500).json({ error: "Failed to delete rider" });
  }
});

/* =========================
   UPDATE RIDER
========================= */
router.put("/:id", async (req, res) => {
  try {
    const { name, phone } = req.body;
    const { id } = req.params;

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    const result = await pool.query(
      `UPDATE riders
       SET name = $1,
           phone = $2
       WHERE id = $3
       RETURNING *`,
      [name, phone, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Rider not found" });
    }

    res.json({
      message: "Rider updated",
      rider: result.rows[0],
    });
  } catch (err) {
    console.error("UPDATE RIDER ERROR:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

/* =========================
   GET ALL RIDERS
========================= */
router.get("/", async (req, res) => {
  try {
    await ensureDeliveryTrackingTables();

    const result = await pool.query(`
      SELECT
        r.*,
        COUNT(o.id) AS total_orders,
        COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) AS delivered_orders,
        COUNT(CASE WHEN o.status != 'delivered' THEN 1 END) AS pending_orders
      FROM riders r
      LEFT JOIN orders o ON o.rider_id = r.id
      GROUP BY r.id
      ORDER BY r.id DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch riders" });
  }
});

/* =========================
   ASSIGN RIDER
========================= */
router.put("/assign/:delivery_id", async (req, res) => {
  try {
    await ensureDeliveryTrackingTables();

    const { delivery_id } = req.params;
    const { rider_id } = req.body;

    await pool.query(
      `UPDATE deliveries
       SET rider_id = $1,
           status = 'assigned',
           delivery_otp = COALESCE(delivery_otp, FLOOR(100000 + RANDOM() * 900000)::text),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [rider_id, delivery_id]
    );

    const deliveryRes = await pool.query(
      "SELECT order_id FROM deliveries WHERE id = $1",
      [delivery_id]
    );

    await pool.query(
      `UPDATE riders SET status='busy' WHERE id=$1`,
      [rider_id]
    );

    if (deliveryRes.rows[0]) {
      await addDeliveryEvent(
        deliveryRes.rows[0].order_id,
        delivery_id,
        "assigned",
        "Rider assigned"
      );
    }

    res.json({ message: "Rider assigned 🚚" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Assignment failed" });
  }
});

/* =========================
   UPDATE DELIVERY STATUS
========================= */
router.put("/status/:delivery_id", async (req, res) => {
  try {
    await ensureDeliveryTrackingTables();

    const { delivery_id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE deliveries
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, delivery_id]
    );

    const delivery = result.rows[0];

    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    await pool.query(
      `UPDATE orders
       SET status = $1
       WHERE id = $2`,
      [status, delivery.order_id]
    );

    await addDeliveryEvent(
      delivery.order_id,
      delivery.id,
      status,
      `Delivery status updated to ${status}`
    );

    if (status === "delivered" && delivery.rider_id) {
      await pool.query(
        `UPDATE riders SET status='available' WHERE id=$1`,
        [delivery.rider_id]
      );
    }

    res.json({ message: "Status updated", status });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Status update failed" });
  }
});

/* =========================
   🔥 UPDATE RIDER LOCATION (SAFE)
========================= */
router.put("/location/:id", async (req, res) => {
  try {
    await ensureDeliveryTrackingTables();

    const { id } = req.params;

    // prevent crash
    if (!req.body) {
      return res.status(400).json({ error: "No body" });
    }

    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    await pool.query(
      `UPDATE riders
       SET latitude = $1,
           longitude = $2,
           last_seen = NOW()
       WHERE id = $3`,
      [latitude, longitude, id]
    );

    await pool.query(
      `UPDATE deliveries
       SET current_lat = $1,
           current_lng = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE rider_id = $3
         AND status IN ('assigned', 'processing', 'in_transit')`,
      [latitude, longitude, id]
    );

    res.json({ message: "Location updated" });

  } catch (err) {
    console.error("LOCATION ERROR:", err);
    res.status(500).json({ error: "Location failed" });
  }
});

module.exports = router;
