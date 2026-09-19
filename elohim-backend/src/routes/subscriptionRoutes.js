const express = require("express");
const pool = require("../config/db");
const sendWhatsApp = require("../utils/sendWhatsApp");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();
let schemaInitPromise;

const ensureSubscriptionSchema = async () => {
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
          quantity INTEGER NOT NULL DEFAULT 1,
          plan VARCHAR(20) NOT NULL,
          next_delivery TIMESTAMP NOT NULL,
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT FALSE
      `);
      await pool.query(`CREATE TABLE IF NOT EXISTS subscription_groups (
        id SERIAL PRIMARY KEY,user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,name VARCHAR(120),plan VARCHAR(20) NOT NULL,custom_days INTEGER,next_delivery TIMESTAMP NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'active',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS subscription_group_items (
        id SERIAL PRIMARY KEY,subscription_group_id INTEGER REFERENCES subscription_groups(id) ON DELETE CASCADE,product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,quantity INTEGER NOT NULL
      )`);
    })().catch((err) => {
      schemaInitPromise = null;
      throw err;
    });
  }

  return schemaInitPromise;
};

router.use(async (req, res, next) => {
  try {
    await ensureSubscriptionSchema();
    next();
  } catch (err) {
    console.error("SUBSCRIPTION SCHEMA ERROR:", err);
    res.status(500).json({
      error: "Subscription setup failed",
      detail: err.message,
    });
  }
});

router.get("/admin/all", verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
        p.name AS product_name, p.weight,
        (SELECT COUNT(*)::int FROM orders o WHERE o.user_id=s.user_id AND o.is_subscription=TRUE AND o.status IN ('failed','payment_pending')) AS failed_payments
      FROM subscriptions s JOIN users u ON u.id=s.user_id JOIN products p ON p.id=s.product_id
      ORDER BY s.next_delivery ASC`);
    const today = new Date(); today.setHours(0,0,0,0);
    const week = new Date(today); week.setDate(week.getDate()+7);
    const rows = result.rows;
    res.json({ subscriptions: rows, stats: {
      active: rows.filter((x)=>x.status==='active').length,
      due_today: rows.filter((x)=>x.status==='active' && new Date(x.next_delivery).toDateString()===today.toDateString()).length,
      due_week: rows.filter((x)=>x.status==='active' && new Date(x.next_delivery)>=today && new Date(x.next_delivery)<week).length,
      failed_payments: rows.reduce((sum,x)=>sum+Number(x.failed_payments||0),0),
      paused: rows.filter((x)=>x.status==='paused').length,
    }});
  } catch (err) { console.error("ADMIN SUBSCRIPTIONS ERROR:", err); res.status(500).json({ error: "Failed to load subscriptions" }); }
});

router.post("/from-order", verifyToken, async (req,res) => {
  const client = await pool.connect();
  try {
    const { order_id, plan, custom_days } = req.body;
    const days = plan === "weekly" ? 7 : plan === "biweekly" ? 14 : plan === "monthly" ? 30 : Number(custom_days);
    if (!order_id || !Number.isInteger(days) || days < 1 || days > 365) return res.status(400).json({ error: "Choose weekly, every 2 weeks, monthly, or a valid custom schedule" });
    await client.query("BEGIN");
    const order = await client.query("SELECT * FROM orders WHERE id=$1 AND user_id=$2", [order_id,req.user.id]);
    if (!order.rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Order not found" }); }
    const items = await client.query("SELECT product_id,quantity FROM order_items WHERE order_id=$1", [order_id]);
    if (!items.rows.length) { await client.query("ROLLBACK"); return res.status(400).json({ error: "This order has no products to schedule" }); }
    const name = plan === "monthly" ? "Monthly Family Pantry" : plan === "weekly" ? "Weekly Supply" : plan === "biweekly" ? "Family Pantry" : "Custom Restock";
    const group = await client.query("INSERT INTO subscription_groups (user_id,name,plan,custom_days,next_delivery) VALUES ($1,$2,$3,$4,NOW()+($5 * INTERVAL '1 day')) RETURNING *", [req.user.id,name,plan,plan === "custom" ? days : null,days]);
    for (const item of items.rows) await client.query("INSERT INTO subscription_group_items (subscription_group_id,product_id,quantity) VALUES ($1,$2,$3)", [group.rows[0].id,item.product_id,item.quantity]);
    await client.query("COMMIT"); res.status(201).json(group.rows[0]);
  } catch (err) { await client.query("ROLLBACK"); console.error("CREATE SUBSCRIPTION GROUP ERROR:",err); res.status(500).json({ error:"Failed to schedule repeat order" }); } finally { client.release(); }
});

router.get("/groups/me", verifyToken, async (req,res) => {
  try { const groups=await pool.query("SELECT * FROM subscription_groups WHERE user_id=$1 ORDER BY created_at DESC",[req.user.id]); const items=await pool.query("SELECT i.*,p.name,p.weight FROM subscription_group_items i JOIN products p ON p.id=i.product_id WHERE i.subscription_group_id=ANY($1::int[])",[groups.rows.map(g=>g.id)]); res.json(groups.rows.map(g=>({...g,items:items.rows.filter(i=>i.subscription_group_id===g.id)}))); }
  catch(err){console.error("GET SUBSCRIPTION GROUPS ERROR:",err);res.status(500).json({error:"Failed to load subscriptions"});}
});
router.patch("/groups/:id", verifyToken, async (req,res) => {
  try { const { action,next_delivery }=req.body; const statuses={pause:"paused",resume:"active",cancel:"cancelled"}; if (!statuses[action] && action!=="skip" && action!=="reschedule") return res.status(400).json({error:"Invalid subscription action"}); const result=action==="skip"?await pool.query("UPDATE subscription_groups SET next_delivery=next_delivery+(CASE WHEN plan='weekly' THEN INTERVAL '7 days' WHEN plan='biweekly' THEN INTERVAL '14 days' WHEN plan='monthly' THEN INTERVAL '30 days' ELSE custom_days*INTERVAL '1 day' END) WHERE id=$1 AND user_id=$2 RETURNING *",[req.params.id,req.user.id]):action==="reschedule"?await pool.query("UPDATE subscription_groups SET next_delivery=$1 WHERE id=$2 AND user_id=$3 RETURNING *",[next_delivery,req.params.id,req.user.id]):await pool.query("UPDATE subscription_groups SET status=$1 WHERE id=$2 AND user_id=$3 RETURNING *",[statuses[action],req.params.id,req.user.id]); if(!result.rows[0])return res.status(404).json({error:"Subscription not found"});res.json(result.rows[0]); }
  catch(err){console.error("MANAGE SUBSCRIPTION ERROR:",err);res.status(500).json({error:"Failed to update subscription"});}
});

/* =========================
   CREATE SUBSCRIPTION + INSTANT ORDER
========================= */
router.post("/", async (req, res) => {
  const { user_id, product_id, quantity, plan } = req.body;
  const parsedUserId = Number(user_id);
  const parsedProductId = Number(product_id);
  const parsedQuantity = Number(quantity);
  const normalizedPlan = typeof plan === "string" ? plan.toLowerCase() : "";

  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    return res.status(400).json({ error: "Valid user_id is required" });
  }

  if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
    return res.status(400).json({ error: "Valid product_id is required" });
  }

  if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
    return res.status(400).json({ error: "Quantity must be greater than 0" });
  }

  if (!["weekly", "biweekly", "monthly"].includes(normalizedPlan)) {
    return res.status(400).json({ error: "Plan must be weekly, every 2 weeks, or monthly" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userRes = await client.query(
      "SELECT id FROM users WHERE id = $1",
      [parsedUserId]
    );

    if (userRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }

    const productRes = await client.query(
      "SELECT id, price FROM products WHERE id = $1",
      [parsedProductId]
    );

    if (productRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Product not found" });
    }

    const price = Number(productRes.rows[0].price || 0);

    if (price <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Product price is invalid" });
    }

    const subRes = await client.query(
      `INSERT INTO subscriptions
       (user_id, product_id, quantity, plan, next_delivery, status)
       VALUES (
         $1,
         $2,
         $3,
         $4::varchar,
           NOW() + CASE
           WHEN $4::text = 'weekly' THEN INTERVAL '7 days'
           WHEN $4::text = 'biweekly' THEN INTERVAL '14 days'
           ELSE INTERVAL '30 days'
         END,
         'active'
       )
       RETURNING *`,
      [parsedUserId, parsedProductId, parsedQuantity, normalizedPlan]
    );

    const subscription = subRes.rows[0];

    const orderRes = await client.query(
      `INSERT INTO orders (user_id, status, total_amount, is_subscription)
       VALUES ($1, 'Processing', $2, true)
       RETURNING id`,
      [parsedUserId, price * parsedQuantity]
    );

    const orderId = orderRes.rows[0].id;

    /* =========================
       AUTO ASSIGN RIDER
    ========================= */
    const riderRes = await client.query(`
      SELECT id
      FROM riders
      WHERE status = 'available'
      ORDER BY current_orders ASC
      LIMIT 1
    `);

    if (riderRes.rows.length > 0) {
      const riderId = riderRes.rows[0].id;

      await client.query(
        "UPDATE orders SET rider_id = $1 WHERE id = $2",
        [riderId, orderId]
      );

      await client.query(
        `UPDATE riders
         SET current_orders = current_orders + 1
         WHERE id = $1`,
        [riderId]
      );

      console.log("Rider auto-assigned:", riderId);
    }

    /* =========================
       SEND WHATSAPP
    ========================= */
    const customerRes = await client.query(
      "SELECT phone, name FROM users WHERE id = $1",
      [parsedUserId]
    );

    const phone = customerRes.rows[0]?.phone;
    const name = customerRes.rows[0]?.name || "Customer";

    if (phone) {
      const message = `Hello ${name},

Your subscription order has been created successfully 🛒

Order ID: ${orderId}
Amount: ₦${price * parsedQuantity}

We will deliver soon 🚚

Elohim Grains 🌾`;

      sendWhatsApp(phone, message);
    }

    await client.query(
      `INSERT INTO order_items (order_id, product_id, quantity, price)
       VALUES ($1, $2, $3, $4)`,
      [orderId, parsedProductId, parsedQuantity, price]
    );

    await client.query("COMMIT");

    res.status(201).json({
      subscription,
      orderId,
      message: "Subscription + Order created successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");

    console.error("SUBSCRIPTION ERROR:", err);

    res.status(500).json({
      error: err.message || "Failed to create subscription",
    });
  } finally {
    client.release();
  }
});

/* =========================
   GET USER SUBSCRIPTIONS
========================= */
router.get("/:userId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, p.name AS product_name
       FROM subscriptions s
       JOIN products p ON s.product_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [req.params.userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("FETCH SUB ERROR:", err);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

/* =========================
   DELETE SUBSCRIPTION
========================= */
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM subscriptions WHERE id = $1", [req.params.id]);

    res.json({ message: "Subscription deleted" });
  } catch (err) {
    console.error("DELETE SUB ERROR:", err);
    res.status(500).json({ error: "Failed to delete subscription" });
  }
});

/* =========================
   PAUSE
========================= */
router.put("/:id/pause", async (req, res) => {
  try {
    await pool.query(
      "UPDATE subscriptions SET status = 'paused' WHERE id = $1",
      [req.params.id]
    );

    res.json({ message: "Subscription paused" });
  } catch (err) {
    console.error("PAUSE ERROR:", err);
    res.status(500).json({ error: "Failed to pause subscription" });
  }
});

/* =========================
   RESUME
========================= */
router.put("/:id/resume", async (req, res) => {
  try {
    await pool.query(
      "UPDATE subscriptions SET status = 'active' WHERE id = $1",
      [req.params.id]
    );

    res.json({ message: "Subscription resumed" });
  } catch (err) {
    console.error("RESUME ERROR:", err);
    res.status(500).json({ error: "Failed to resume subscription" });
  }
});

/* =========================
   SKIP NEXT DELIVERY
========================= */
router.put("/:id/skip", async (req, res) => {
  try {
    const subRes = await pool.query(
      "SELECT plan FROM subscriptions WHERE id = $1",
      [req.params.id]
    );

    if (subRes.rows.length === 0) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const plan = subRes.rows[0].plan;
    const interval = plan === "weekly" ? "7 days" : plan === "biweekly" ? "14 days" : "30 days";

    await pool.query(
      `UPDATE subscriptions
       SET next_delivery = next_delivery + INTERVAL '${interval}'
       WHERE id = $1`,
      [req.params.id]
    );

    res.json({ message: "Next delivery skipped" });
  } catch (err) {
    console.error("SKIP ERROR:", err);
    res.status(500).json({ error: "Failed to skip delivery" });
  }
});

module.exports = router;
