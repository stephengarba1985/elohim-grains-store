const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { promisify } = require("util");
const pool = require("../config/db");
const sendWhatsApp = require("../utils/sendWhatsApp");
const { verifyToken, isAdmin, requirePermission, requireRiderSession } = require("../middleware/auth");
const {
  ensureDeliveryTrackingTables,
  addDeliveryEvent,
  verifyDeliveryOtp,
  OTP_MAX_ATTEMPTS,
  OTP_LOCK_MINUTES,
} = require("./trackingRoutes");

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("JWT_SECRET is required");
const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
const adminRiders = [verifyToken, isAdmin, requirePermission("riders")];
const scryptAsync = promisify(crypto.scrypt);

const hashRiderPin = async (pin) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scryptAsync(String(pin), salt, 32);
  return `scrypt:${salt}:${Buffer.from(derived).toString("hex")}`;
};

const verifyRiderPin = async (pin, stored) => {
  const value = String(stored || "");
  if (!value.startsWith("scrypt:")) return false;
  const [, salt, expectedHex] = value.split(":");
  if (!salt || !expectedHex) return false;
  const derived = Buffer.from(await scryptAsync(String(pin || ""), salt, 32));
  const expected = Buffer.from(expectedHex, "hex");
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
};

const ensureRiderCredentialColumn = () => pool.query(`
  ALTER TABLE riders
    ADD COLUMN IF NOT EXISTS portal_pin_hash TEXT
`);

const sanitizeRider = (rider) => {
  if (!rider) return rider;
  const { portal_pin_hash, ...safe } = rider;
  return safe;
};

/* =========================
   RIDER PORTAL AUTHENTICATION
========================= */
router.post("/portal/login", async (req, res) => {
  try {
    const riderId = Number(req.body.rider_id);
    const phone = normalizePhone(req.body.phone);
    const pin = String(req.body.pin || "").trim();

    if (!Number.isInteger(riderId) || !phone || !pin) {
      return res.status(400).json({ error: "Rider ID, phone number, and PIN are required" });
    }

    await ensureRiderCredentialColumn();
    const result = await pool.query("SELECT * FROM riders WHERE id = $1", [riderId]);
    const rider = result.rows[0];
    if (!rider || normalizePhone(rider.phone) !== phone) {
      return res.status(401).json({ error: "Rider credentials are incorrect" });
    }
    if (!rider.portal_pin_hash) {
      return res.status(428).json({ error: "Rider portal PIN setup is required. Contact an administrator." });
    }
    if (!(await verifyRiderPin(pin, rider.portal_pin_hash))) {
      return res.status(401).json({ error: "Rider credentials are incorrect" });
    }

    const token = jwt.sign(
      { type: "rider_portal", rider_id: rider.id },
      jwtSecret,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      rider: { id: rider.id, name: rider.name, phone: rider.phone, vehicle_type: rider.vehicle_type },
    });
  } catch (err) {
    console.error("RIDER PORTAL LOGIN ERROR:", err);
    res.status(500).json({ error: "Rider sign-in failed" });
  }
});

router.get("/portal/deliveries", verifyToken, requireRiderSession, async (req, res) => {
  try {
    await ensureDeliveryTrackingTables();
    const result = await pool.query(
      `SELECT d.id AS delivery_id, d.status AS delivery_status, d.eta_minutes, d.created_at,
              o.id AS order_id, o.order_number, o.delivery_address, o.total_amount,
              u.name AS customer_name, u.phone AS customer_phone,
              COALESCE(json_agg(json_build_object('name', p.name, 'quantity', oi.quantity))
                FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
       FROM deliveries d
       JOIN orders o ON o.id = d.order_id
       JOIN users u ON u.id = o.user_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE d.rider_id = $1
         AND COALESCE(d.status, o.status) NOT IN ('delivered', 'cancelled', 'delivery_failed', 'failed')
       GROUP BY d.id, o.id, u.id
       ORDER BY CASE WHEN d.status = 'in_transit' THEN 0 ELSE 1 END, d.created_at ASC`,
      [req.rider.id]
    );
    res.json({ rider: { id: req.rider.id, name: req.rider.name }, deliveries: result.rows });
  } catch (err) {
    console.error("RIDER DELIVERIES ERROR:", err);
    res.status(500).json({ error: "Could not load deliveries" });
  }
});

router.put("/portal/deliveries/:deliveryId/start", verifyToken, requireRiderSession, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE deliveries
       SET status = 'in_transit', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND rider_id = $2
         AND status IN ('assigned', 'ready_for_delivery', 'pending')
       RETURNING *`,
      [req.params.deliveryId, req.rider.id]
    );
    const delivery = result.rows[0];
    if (!delivery) return res.status(404).json({ error: "Assigned delivery not found" });

    await pool.query("UPDATE orders SET status = 'in_transit' WHERE id = $1", [delivery.order_id]);
    await addDeliveryEvent(delivery.order_id, delivery.id, "in_transit", "Rider started delivery");
    res.json({ message: "Delivery started", delivery });
  } catch (err) {
    console.error("START DELIVERY ERROR:", err);
    res.status(500).json({ error: "Could not start delivery" });
  }
});

router.post("/portal/deliveries/:deliveryId/confirm", verifyToken, requireRiderSession, async (req, res) => {
  try {
    const otp = String(req.body.otp || "").trim();
    const deliveryRes = await pool.query(
      "SELECT * FROM deliveries WHERE id = $1 AND rider_id = $2",
      [req.params.deliveryId, req.rider.id]
    );
    const delivery = deliveryRes.rows[0];
    if (!delivery) return res.status(404).json({ error: "Assigned delivery not found" });
    if (!["in_transit", "near_customer"].includes(String(delivery.status || ""))) {
      return res.status(409).json({ error: "Delivery must be in transit before it can be confirmed" });
    }
    if (delivery.otp_confirmed || delivery.status === "delivered") {
      return res.status(409).json({ error: "Delivery has already been confirmed" });
    }
    if (delivery.otp_locked_until && new Date(delivery.otp_locked_until) > new Date()) {
      return res.status(429).json({ error: "Too many incorrect PIN attempts. Try again later." });
    }

    if (!otp || !(await verifyDeliveryOtp(otp, delivery.delivery_otp))) {
      await pool.query(
        `UPDATE deliveries
         SET otp_failed_attempts = COALESCE(otp_failed_attempts, 0) + 1,
             otp_locked_until = CASE
               WHEN COALESCE(otp_failed_attempts, 0) + 1 >= $2
               THEN CURRENT_TIMESTAMP + ($3 * INTERVAL '1 minute')
               ELSE otp_locked_until
             END
         WHERE id = $1`,
        [delivery.id, OTP_MAX_ATTEMPTS, OTP_LOCK_MINUTES]
      );
      return res.status(400).json({ error: "The delivery PIN does not match" });
    }

    await pool.query(
      `UPDATE deliveries SET status = 'delivered', otp_confirmed = TRUE,
       confirmed_at = CURRENT_TIMESTAMP, otp_failed_attempts = 0,
       otp_locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [delivery.id]
    );
    await pool.query("UPDATE orders SET status = 'delivered' WHERE id = $1", [delivery.order_id]);
    await pool.query(
      "UPDATE riders SET status = 'available', current_orders = GREATEST(COALESCE(current_orders, 0) - 1, 0) WHERE id = $1",
      [req.rider.id]
    );
    await addDeliveryEvent(delivery.order_id, delivery.id, "delivered", "Delivery PIN confirmed by rider");

    const customerRes = await pool.query(
      "SELECT u.name, u.phone, o.order_number FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1",
      [delivery.order_id]
    );
    const customer = customerRes.rows[0];
    if (customer?.phone) {
      sendWhatsApp(customer.phone, `Hello ${customer.name || "Customer"}, your Elohim Grains order ${customer.order_number || `#${delivery.order_id}`} has been delivered and verified. Thank you for shopping with us.`);
    }
    res.json({ message: "Delivery confirmed" });
  } catch (err) {
    console.error("RIDER DELIVERY CONFIRMATION ERROR:", err);
    res.status(500).json({ error: "Could not confirm delivery" });
  }
});

router.put("/portal/location", verifyToken, requireRiderSession, async (req, res) => {
  try {
    await ensureDeliveryTrackingTables();
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ error: "Valid location coordinates are required" });
    }
    await pool.query(
      `UPDATE riders SET latitude = $1, longitude = $2, last_seen = NOW() WHERE id = $3`,
      [latitude, longitude, req.rider.id]
    );
    await pool.query(
      `UPDATE deliveries SET current_lat = $1, current_lng = $2, updated_at = CURRENT_TIMESTAMP
       WHERE rider_id = $3 AND status IN ('assigned', 'ready_for_delivery', 'in_transit')`,
      [latitude, longitude, req.rider.id]
    );
    res.json({ message: "Location updated" });
  } catch (err) {
    console.error("RIDER LOCATION ERROR:", err);
    res.status(500).json({ error: "Could not update location" });
  }
});

/* =========================
   CREATE RIDER
========================= */
router.post("/", ...adminRiders, async (req, res) => {
  try {
    await ensureRiderCredentialColumn();
    const {
      name,
      phone,
      email,
      vehicle_type,
      plate_number,
      license_number,
      avatar,
      address,
      emergency_contact,
      emergency_phone,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    const result = await pool.query(
      `
      INSERT INTO riders
      (
      name,
      phone,
      email,
      vehicle_type,
      plate_number,
      license_number,
      avatar,
      address,
      emergency_contact,
      emergency_phone,
      status
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'available')
      RETURNING *
      `,
      [
        name,
        phone,
        email,
        vehicle_type,
        plate_number,
        license_number,
        avatar,
        address,
        emergency_contact,
        emergency_phone,
      ]
    );

    res.json(sanitizeRider(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create rider" });
  }
});

/* =========================
   SET / RESET RIDER PORTAL PIN
========================= */
router.put("/:id/portal-pin", ...adminRiders, async (req, res) => {
  try {
    const pin = String(req.body.pin || "").trim();
    if (!/^\\d{6}$/.test(pin)) {
      return res.status(400).json({ error: "Rider portal PIN must be exactly 6 digits" });
    }

    await ensureRiderCredentialColumn();
    const pinHash = await hashRiderPin(pin);
    const result = await pool.query(
      "UPDATE riders SET portal_pin_hash = $1 WHERE id = $2 RETURNING id, name, phone, email, status",
      [pinHash, req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Rider not found" });
    res.json({ message: "Rider portal PIN updated", rider: result.rows[0] });
  } catch (err) {
    console.error("RIDER PIN UPDATE ERROR:", err);
    res.status(500).json({ error: "Could not update rider portal PIN" });
  }
});

/* =========================
   DELETE RIDER
========================= */
router.delete("/:id", ...adminRiders, async (req, res) => {
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
router.put("/:id", ...adminRiders, async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      vehicle_type,
      plate_number,
      license_number,
      avatar,
      address,
      emergency_contact,
      emergency_phone,
      status,
    } = req.body;
    const { id } = req.params;

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    const result = await pool.query(
      `UPDATE riders
       SET
       name=$1,
       phone=$2,
       email=$3,
       vehicle_type=$4,
       plate_number=$5,
       license_number=$6,
       avatar=$7,
       address=$8,
       emergency_contact=$9,
       emergency_phone=$10,
       status=$11
       WHERE id=$12
       RETURNING *`,
      [
        name,
        phone,
        email,
        vehicle_type,
        plate_number,
        license_number,
        avatar,
        address,
        emergency_contact,
        emergency_phone,
        status,
        id,
      ]
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
   UPDATE RIDER STATUS
========================= */
router.put("/:id/status", ...adminRiders, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, online } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const result = await pool.query(
      `UPDATE riders
       SET status = $1,
           online = COALESCE($2, online)
       WHERE id = $3
       RETURNING *`,
      [status, online, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Rider not found" });
    }

    res.json({
      message: "Rider status updated",
      rider: result.rows[0],
    });
  } catch (err) {
    console.error("UPDATE RIDER STATUS ERROR:", err);
    res.status(500).json({ error: "Failed to update rider status" });
  }
});

/* =========================
   GET ALL RIDERS
========================= */
router.get("/", ...adminRiders, async (req, res) => {
  try {
    await ensureDeliveryTrackingTables();

    const result = await pool.query(`
      SELECT
        r.*,
        COUNT(o.id)::int total_orders,
        COUNT(
          CASE
            WHEN o.status='delivered' THEN 1
          END
        )::int delivered_orders,
        COUNT(
          CASE
            WHEN o.status!='delivered' THEN 1
          END
        )::int pending_orders,
        COALESCE(
          SUM(
            CASE
              WHEN o.status='delivered' THEN o.total_amount
              ELSE 0
            END
          ),
          0
        ) revenue_generated
      FROM riders r
      LEFT JOIN orders o
      ON o.rider_id=r.id
      GROUP BY r.id
      ORDER BY r.name
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch riders" });
  }
});

router.get("/stats/summary", ...adminRiders, async (req, res) => {
  try {
    const columnsRes = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'riders'
         AND column_name IN ('online', 'earnings')`
    );

    const availableColumns = new Set(columnsRes.rows.map((row) => row.column_name));
    const onlineExpr = availableColumns.has("online")
      ? "COUNT(*) FILTER (WHERE online=true)::int"
      : "0::int";
    const earningsExpr = availableColumns.has("earnings")
      ? "COALESCE(SUM(earnings), 0)"
      : "0::numeric";

    const stats = await pool.query(`
      SELECT
        COUNT(*)::int total,
        COUNT(*) FILTER (WHERE status='available')::int available,
        COUNT(*) FILTER (WHERE status='busy')::int busy,
        ${onlineExpr} online,
        ${earningsExpr} earnings
      FROM riders
    `);

    res.json(stats.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load rider statistics" });
  }
});

/* =========================
   ASSIGN RIDER
========================= */
router.put("/assign/:delivery_id", ...adminRiders, async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureDeliveryTrackingTables();

    const { delivery_id } = req.params;
    const { rider_id } = req.body;

    await client.query("BEGIN");

    const deliveryRes = await client.query(
      `SELECT d.id, d.order_id, d.status AS delivery_status, d.rider_id,
              o.status AS order_status
       FROM deliveries d
       JOIN orders o ON o.id = d.order_id
       WHERE d.id = $1
       FOR UPDATE OF d, o`,
      [delivery_id]
    );
    const delivery = deliveryRes.rows[0];

    if (!delivery) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Delivery not found" });
    }

    if (!["ready_for_delivery", "delivery_failed"].includes(delivery.order_status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Order is not ready for rider assignment" });
    }

    if (["delivered", "cancelled"].includes(delivery.delivery_status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Terminal delivery cannot be reassigned" });
    }

    const riderRes = await client.query(
      "SELECT id, status FROM riders WHERE id = $1 FOR UPDATE",
      [rider_id]
    );
    const rider = riderRes.rows[0];

    if (!rider) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Rider not found" });
    }

    if (!["available", "active"].includes(String(rider.status || "").toLowerCase())) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Rider is not available" });
    }

    await client.query(
      `UPDATE deliveries
       SET rider_id = $1,
           status = 'assigned',
           delivery_otp = COALESCE(delivery_otp, FLOOR(100000 + RANDOM() * 900000)::text),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [rider_id, delivery_id]
    );

    await client.query(
      "UPDATE orders SET rider_id = $1, status = 'assigned' WHERE id = $2",
      [rider_id, delivery.order_id]
    );

    await client.query(
      `UPDATE riders
       SET status = 'busy',
           current_orders = COALESCE(current_orders, 0) + 1
       WHERE id = $1`,
      [rider_id]
    );

    await client.query("COMMIT");

    await addDeliveryEvent(
      delivery.order_id,
      delivery_id,
      "assigned",
      "Rider assigned"
    );

    res.json({ message: "Rider assigned 🚚" });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Assignment failed" });
  } finally {
    client.release();
  }
});

/* =========================
   UPDATE DELIVERY STATUS
========================= */
router.put("/status/:delivery_id", ...adminRiders, async (req, res) => {
  try {
    await ensureDeliveryTrackingTables();

    const { delivery_id } = req.params;
    const { status } = req.body;

    const allowedStatuses = new Set([
      "assigned",
      "picked_up",
      "in_transit",
      "near_customer",
      "delivery_failed",
      "cancelled",
    ]);

    if (status === "delivered") {
      return res.status(409).json({
        error: "Delivered status requires successful delivery PIN confirmation.",
      });
    }

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: "Invalid delivery status" });
    }

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
      await pool.query(`UPDATE riders SET status='available' WHERE id=$1`, [
        delivery.rider_id,
      ]);
    }

    res.json({ message: "Status updated", status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Status update failed" });
  }
});

/* =========================
   UPDATE RIDER LOCATION
========================= */
router.put("/location/:id", ...adminRiders, async (req, res) => {
  try {
    await ensureDeliveryTrackingTables();

    const { id } = req.params;

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
