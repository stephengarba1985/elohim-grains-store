const pool = require("../config/db");
const axios = require("axios");
const sendWhatsApp = require("./sendWhatsApp");

const runSubscriptions = async () => {
  try {
    console.log("Running subscription job...");

    const dueSubs = await pool.query(`
      SELECT s.*, p.price
      FROM subscriptions s
      JOIN products p ON s.product_id = p.id
      WHERE s.next_delivery <= NOW()
      AND s.status = 'active'
    `);

    for (const sub of dueSubs.rows) {
      console.log(`Processing sub ID: ${sub.id}`);

      const total = Number(sub.price || 0) * Number(sub.quantity || 0);

      const billingUserRes = await pool.query(
        "SELECT email, authorization_code, phone, name FROM users WHERE id = $1",
        [sub.user_id]
      );

      const user = billingUserRes.rows[0];

      if (!user?.email || !user?.authorization_code) {
        console.log(`Skipping subscription ${sub.id}: missing saved card details`);
        continue;
      }

      await axios.post(
        "https://api.paystack.co/transaction/charge_authorization",
        {
          authorization_code: user.authorization_code,
          email: user.email,
          amount: total * 100,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      const orderRes = await pool.query(
        `INSERT INTO orders (user_id, status, total_amount, is_subscription)
         VALUES ($1, 'Processing', $2, true)
         RETURNING id`,
        [sub.user_id, total]
      );

      const orderId = orderRes.rows[0].id;

      const riderRes = await pool.query(`
        SELECT id
        FROM riders
        WHERE status = 'available'
        ORDER BY current_orders ASC
        LIMIT 1
      `);

      let riderId = null;

      if (riderRes.rows.length > 0) {
        riderId = riderRes.rows[0].id;

        await pool.query(
          "UPDATE orders SET rider_id = $1 WHERE id = $2",
          [riderId, orderId]
        );

        await pool.query(
          `UPDATE riders
           SET current_orders = current_orders + 1
           WHERE id = $1`,
          [riderId]
        );

        console.log("Rider auto-assigned:", riderId);

        const riderInfo = await pool.query(
          "SELECT phone, name FROM riders WHERE id = $1",
          [riderId]
        );

        const riderPhone = riderInfo.rows[0]?.phone;

        if (riderPhone) {
          sendWhatsApp(
            riderPhone,
            `New delivery assigned 🚚

Order ID: ${orderId}
Please pick up and deliver.

Elohim Logistics`
          );
        }
      }

      const phone = user.phone;
      const name = user.name || "Customer";

      if (phone) {
        const message = `Hello ${name},

Your subscription order has been created successfully 🛒

Order ID: ${orderId}
Amount: ₦${total}

We will deliver soon 🚚

Elohim Grains 🌾`;

        sendWhatsApp(phone, message);
      }

      await pool.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, sub.product_id, sub.quantity, sub.price]
      );

      const interval = sub.plan === "weekly" ? "7 days" : "30 days";

      await pool.query(
        `UPDATE subscriptions
         SET next_delivery = NOW() + INTERVAL '${interval}'
         WHERE id = $1`,
        [sub.id]
      );

      console.log(`Order created for subscription ${sub.id}`);
    }

    console.log("Subscription job completed");
  } catch (err) {
    console.error("Subscription job error:", err.response?.data || err.message || err);
  }
};

module.exports = runSubscriptions;
