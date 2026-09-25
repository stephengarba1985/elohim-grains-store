const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth");
const sendWhatsApp = require("../utils/sendWhatsApp");
const crypto = require("crypto");
const { promisify } = require("util");

const scryptAsync = promisify(crypto.scrypt);
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_MINUTES = 15;

const hashDeliveryOtp = async (otp) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scryptAsync(String(otp), salt, 32);
  return `scrypt:${salt}:${Buffer.from(derived).toString("hex")}`;
};

const verifyDeliveryOtp = async (otp, stored) => {
  const value = String(stored || "");
  if (!value.startsWith("scrypt:")) return value.length > 0 && value === String(otp || "");
  const [, salt, expectedHex] = value.split(":");
  if (!salt || !expectedHex) return false;
  const derived = Buffer.from(await scryptAsync(String(otp || ""), salt, 32));
  const expected = Buffer.from(expectedHex, "hex");
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
};

let trackingSetupPromise = null;

const generateOtp = () => String(crypto.randomInt(100000, 1000000));

const issueDeliveryOtp = async (client, deliveryId) => {
  const otp = generateOtp();
  const hash = await hashDeliveryOtp(otp);
  const updated = await client.query(
    `UPDATE deliveries
     SET delivery_otp=$1, otp_confirmed=FALSE, otp_failed_attempts=0,
         otp_locked_until=NULL, updated_at=CURRENT_TIMESTAMP
     WHERE id=$2
     RETURNING id, order_id`,
    [hash, deliveryId]
  );
  if (!updated.rows[0]) throw new Error("Delivery not found");
  return { otp, delivery: updated.rows[0] };
};

const notifyCustomerDeliveryOtp = async (orderId, otp) => {
  const customerRes = await pool.query(
    `SELECT u.name, u.phone, o.order_number
     FROM orders o JOIN users u ON u.id=o.user_id
     WHERE o.id=$1`,
    [orderId]
  );
  const customer = customerRes.rows[0];
  if (customer?.phone) {
    await Promise.resolve(sendWhatsApp(
      customer.phone,
      `Hello ${customer.name || "Customer"}, your delivery PIN for Elohim Grains order ${customer.order_number || `#${orderId}`} is ${otp}. Give this PIN to the rider only after you receive your order.`
    ));
  }
};

const ensureDeliveryTrackingTables = async () => {
  if (trackingSetupPromise) return trackingSetupPromise;

  trackingSetupPromise = (async () => {
    await pool.query(`
      ALTER TABLE riders
        ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7),
        ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7),
        ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP,
        ADD COLUMN IF NOT EXISTS current_orders INTEGER DEFAULT 0
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id SERIAL PRIMARY KEY,
        order_id INTEGER UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
        rider_id INTEGER REFERENCES riders(id) ON DELETE SET NULL,
        status VARCHAR(30) DEFAULT 'pending',
        eta_minutes INTEGER DEFAULT 30,
        delivery_otp TEXT,
        otp_confirmed BOOLEAN DEFAULT FALSE,
        confirmed_at TIMESTAMP,
        current_lat DECIMAL(10,7),
        current_lng DECIMAL(10,7),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure older production tables receive new tracking columns.
    await pool.query(`
      ALTER TABLE deliveries
        ADD COLUMN IF NOT EXISTS eta_minutes INTEGER DEFAULT 30,
        ADD COLUMN IF NOT EXISTS delivery_otp TEXT,
        ADD COLUMN IF NOT EXISTS otp_failed_attempts INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS otp_locked_until TIMESTAMP,
        ADD COLUMN IF NOT EXISTS otp_confirmed BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS current_lat DECIMAL(10,7),
        ADD COLUMN IF NOT EXISTS current_lng DECIMAL(10,7),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    await pool.query(`ALTER TABLE deliveries ALTER COLUMN delivery_otp TYPE TEXT`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_events (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        delivery_id INTEGER REFERENCES deliveries(id) ON DELETE CASCADE,
        status VARCHAR(30) NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  })();

  try {
    await trackingSetupPromise;
  } catch (err) {
    trackingSetupPromise = null;
    throw err;
  }
};

const ensureDeliveryForOrder = async (orderId, riderId = null, status = "pending") => {
  await ensureDeliveryTrackingTables();

  const existing = await pool.query(
    "SELECT * FROM deliveries WHERE order_id = $1",
    [orderId]
  );

  if (existing.rows.length > 0) {
    if (riderId || status) {
      const updated = await pool.query(
        `UPDATE deliveries
         SET rider_id = COALESCE($1, rider_id),
             status = COALESCE($2, status),
             delivery_otp = COALESCE(delivery_otp, $3),
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $4
         RETURNING *`,
        [riderId, status, await hashDeliveryOtp(generateOtp()), orderId]
      );

      return updated.rows[0];
    }

    return existing.rows[0];
  }

  const created = await pool.query(
    `INSERT INTO deliveries (order_id, rider_id, status, delivery_otp)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [orderId, riderId, status, await hashDeliveryOtp(generateOtp())]
  );

  return created.rows[0];
};

const addDeliveryEvent = async (orderId, deliveryId, status, note = "") => {
  await pool.query(
    `INSERT INTO delivery_events (order_id, delivery_id, status, note)
     VALUES ($1, $2, $3, $4)`,
    [orderId, deliveryId, status, note]
  );
};

const getTrackingData = async (orderId) => {
  await ensureDeliveryTrackingTables();

  const result = await pool.query(
    `SELECT
       o.*,
       d.id AS delivery_id,
       d.status AS delivery_status,
       d.eta_minutes,
       d.delivery_otp,
       d.otp_confirmed,
       d.confirmed_at,
       d.current_lat,
       d.current_lng,
       r.id AS rider_id,
       r.name AS rider_name,
       r.phone AS rider_phone,
       r.latitude,
       r.longitude,
       r.last_seen
     FROM orders o
     LEFT JOIN deliveries d ON d.order_id = o.id
     LEFT JOIN riders r ON r.id = COALESCE(d.rider_id, o.rider_id)
     WHERE o.id = $1`,
    [orderId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const eventsRes = await pool.query(
    `SELECT status, note, created_at
     FROM delivery_events
     WHERE order_id = $1
     ORDER BY created_at DESC`,
    [orderId]
  );

  return {
    id: row.id,
    user_id: row.user_id,
    status: row.status,
    total_amount: row.total_amount,
    created_at: row.created_at,
    delivery: {
      id: row.delivery_id,
      status: row.delivery_status || row.status || "pending",
      eta: row.eta_minutes ? `${row.eta_minutes} mins` : "Not available",
      eta_minutes: row.eta_minutes,
      otp: row.delivery_otp,
      otp_confirmed: row.otp_confirmed,
      confirmed_at: row.confirmed_at,
      destination: { lat: 9.0765, lng: 7.3986 },
    },
    rider: row.rider_id
      ? {
          id: row.rider_id,
          name: row.rider_name,
          phone: row.rider_phone,
          last_seen: row.last_seen,
          location: {
            lat: Number(row.current_lat || row.latitude || 9.0765),
            lng: Number(row.current_lng || row.longitude || 7.3986),
          },
        }
      : null,
    events: eventsRes.rows,
  };
};

router.get("/:id", verifyToken, async (req, res) => {
  try {
    const tracking = await getTrackingData(req.params.id);

    if (!tracking || (Number(tracking.user_id) !== Number(req.user.id) && !req.user.is_admin)) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      order: {
        id: tracking.id,
        status: tracking.status,
        eta: tracking.delivery.eta,
        address: tracking.delivery.destination,
      },
      delivery: {
        ...tracking.delivery,
        otp: tracking.delivery.otp ? "******" : null,
      },
      rider: tracking.rider,
      events: tracking.events,
    });
  } catch (err) {
    console.error("TRACKING ERROR:", err);
    res.status(500).json({ error: "Tracking failed" });
  }
});

router.get("/order/:order_id", verifyToken, async (req, res) => {
  try {
    const tracking = await getTrackingData(req.params.order_id);

    if (!tracking || (Number(tracking.user_id) !== Number(req.user.id) && !req.user.is_admin)) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      id: tracking.id,
      status: tracking.status,
      total_amount: tracking.total_amount,
      created_at: tracking.created_at,
      delivery: {
        ...tracking.delivery,
        otp: tracking.delivery.otp ? "******" : null,
      },
      rider_name: tracking.rider?.name || null,
      rider_phone: tracking.rider?.phone || null,
      latitude: tracking.rider?.location?.lat || null,
      longitude: tracking.rider?.location?.lng || null,
      events: tracking.events,
    });
  } catch (err) {
    console.error("TRACKING ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

router.patch("/order/:order_id/eta", verifyToken, isAdmin, async (req, res) => {
  try {
    const eta = Number(req.body.eta_minutes);

    if (!Number.isFinite(eta) || eta <= 0) {
      return res.status(400).json({ error: "Valid ETA minutes are required" });
    }

    const delivery = await ensureDeliveryForOrder(req.params.order_id);
    const updated = await pool.query(
      `UPDATE deliveries
       SET eta_minutes = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [eta, delivery.id]
    );

    await addDeliveryEvent(
      req.params.order_id,
      delivery.id,
      "eta_updated",
      `ETA updated to ${eta} minutes`
    );

    res.json(updated.rows[0]);
  } catch (err) {
    console.error("ETA UPDATE ERROR:", err);
    res.status(500).json({ error: "ETA update failed" });
  }
});

router.post("/order/:order_id/confirm-otp", verifyToken, isAdmin, async (req, res) => {
  try {
    const { otp } = req.body;
    const delivery = await ensureDeliveryForOrder(req.params.order_id);

    if (!["in_transit", "near_customer"].includes(String(delivery.status || ""))) {
      return res.status(409).json({ error: "Delivery must be in transit before confirmation" });
    }
    if (delivery.otp_confirmed || delivery.status === "delivered") {
      return res.status(409).json({ error: "Delivery has already been confirmed" });
    }
    if (delivery.otp_locked_until && new Date(delivery.otp_locked_until) > new Date()) {
      return res.status(429).json({ error: "Too many incorrect PIN attempts. Try again later." });
    }

    if (!delivery.delivery_otp || !(await verifyDeliveryOtp(otp, delivery.delivery_otp))) {
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
      return res.status(400).json({ error: "Invalid delivery OTP" });
    }

    const updated = await pool.query(
      `UPDATE deliveries
       SET status = 'delivered',
           otp_confirmed = TRUE,
           confirmed_at = CURRENT_TIMESTAMP,
           otp_failed_attempts = 0,
           otp_locked_until = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [delivery.id]
    );

    await pool.query(
      "UPDATE orders SET status = 'delivered' WHERE id = $1",
      [req.params.order_id]
    );

    if (delivery.rider_id) {
      await pool.query(
        "UPDATE riders SET status = 'available', current_orders = GREATEST(COALESCE(current_orders, 0) - 1, 0) WHERE id = $1",
        [delivery.rider_id]
      );
    }

    await addDeliveryEvent(req.params.order_id, delivery.id, "delivered", "Delivery OTP confirmed");

    const customerRes = await pool.query(
      `SELECT u.name, u.phone, o.order_number FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`,
      [req.params.order_id]
    );
    const customer = customerRes.rows[0];
    if (customer?.phone) {
      sendWhatsApp(customer.phone, `Hello ${customer.name || "Customer"}, your Elohim Grains order ${customer.order_number || `#${req.params.order_id}`} has been delivered and verified. Thank you for shopping with us.`);
    }

    res.json(updated.rows[0]);
  } catch (err) {
    console.error("OTP CONFIRMATION ERROR:", err);
    res.status(500).json({ error: "OTP confirmation failed" });
  }
});

module.exports = {
  router,
  ensureDeliveryTrackingTables,
  ensureDeliveryForOrder,
  addDeliveryEvent,
  verifyDeliveryOtp,
  OTP_MAX_ATTEMPTS,
  OTP_LOCK_MINUTES,
  issueDeliveryOtp,
  notifyCustomerDeliveryOtp,
};
