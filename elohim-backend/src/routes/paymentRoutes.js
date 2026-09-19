const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const pool = require("../config/db");
const { ensurePaymentGatewayTables } = require("./paymentGatewayRoutes");
const { sendOrderConfirmationEmail } = require("../utils/mail");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();
const ensureRefunds = () => pool.query(`CREATE TABLE IF NOT EXISTS refund_requests (
 id SERIAL PRIMARY KEY,order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,payment_transaction_id INTEGER REFERENCES payment_transactions(id) ON DELETE SET NULL,user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
 original_amount DECIMAL(12,2) NOT NULL,requested_amount DECIMAL(12,2) NOT NULL,reason TEXT NOT NULL,refund_method VARCHAR(40) NOT NULL DEFAULT 'original_payment_method',status VARCHAR(30) NOT NULL DEFAULT 'pending',reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,reviewed_at TIMESTAMP,processed_at TIMESTAMP,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

router.post("/refunds", verifyToken, async (req,res) => {
 try { await ensureRefunds(); const {order_id,amount,reason,refund_method}=req.body; const order=await pool.query("SELECT o.*,pt.id AS payment_transaction_id FROM orders o LEFT JOIN payment_transactions pt ON pt.order_id=o.id AND pt.status='verified' WHERE o.id=$1 AND o.user_id=$2 LIMIT 1",[order_id,req.user.id]); if(!order.rows[0])return res.status(404).json({error:"Verified order not found"}); const requested=Number(amount||order.rows[0].total_amount); if(requested<=0||requested>Number(order.rows[0].total_amount)||!reason)return res.status(400).json({error:"Valid refund amount and reason are required"}); const result=await pool.query("INSERT INTO refund_requests (order_id,payment_transaction_id,user_id,original_amount,requested_amount,reason,refund_method) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",[order_id,order.rows[0].payment_transaction_id,req.user.id,order.rows[0].total_amount,requested,reason,refund_method||"original_payment_method"]);res.status(201).json(result.rows[0]); }catch(err){console.error("REFUND REQUEST ERROR:",err);res.status(500).json({error:"Failed to request refund"});}
});
router.get("/refunds", verifyToken, isAdmin, async(req,res)=>{try{await ensureRefunds();const result=await pool.query("SELECT r.*,u.name AS customer_name,o.order_number,pt.reference AS payment_reference FROM refund_requests r LEFT JOIN users u ON u.id=r.user_id LEFT JOIN orders o ON o.id=r.order_id LEFT JOIN payment_transactions pt ON pt.id=r.payment_transaction_id ORDER BY r.created_at DESC");res.json(result.rows);}catch(err){res.status(500).json({error:"Failed to load refunds"});}});
router.patch("/refunds/:id", verifyToken, isAdmin, async(req,res)=>{try{await ensureRefunds();const {status}=req.body;if(!['approved','rejected','processed'].includes(status))return res.status(400).json({error:"Invalid refund status"});const result=await pool.query("UPDATE refund_requests SET status=$1,reviewed_by=$2,reviewed_at=COALESCE(reviewed_at,NOW()),processed_at=CASE WHEN $1='processed' THEN NOW() ELSE processed_at END WHERE id=$3 AND status IN ('pending','approved') RETURNING *",[status,req.user.id,req.params.id]);if(!result.rows[0])return res.status(400).json({error:"Refund cannot be updated"});res.json(result.rows[0]);}catch(err){res.status(500).json({error:"Failed to update refund"});}});

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.status(500).json({
        error: "PAYSTACK_SECRET_KEY is not configured.",
      });
    }

    if (!signature || !Buffer.isBuffer(req.body)) {
      return res.sendStatus(401);
    }

    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(req.body)
      .digest("hex");

    const signatureBuffer = Buffer.from(String(signature), "utf8");
    const hashBuffer = Buffer.from(hash, "utf8");

    if (
      signatureBuffer.length !== hashBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, hashBuffer)
    ) {
      return res.sendStatus(401);
    }

    const event = JSON.parse(req.body.toString());

    if (event.event !== "charge.success") {
      return res.sendStatus(200);
    }

    await ensurePaymentGatewayTables();

    const payment = event.data;
    const reference = payment.reference;

    const existing = await pool.query(
      `
      SELECT *
      FROM payment_transactions
      WHERE reference=$1
      `,
      [reference]
    );

    if (existing.rows.length === 0) {
      return res.sendStatus(404);
    }

    if (existing.rows[0].status === "verified") {
      return res.sendStatus(200);
    }

    if (payment.status !== "success") {
      return res.sendStatus(400);
    }

    if (payment.currency !== "NGN") {
      return res.sendStatus(400);
    }

    const expectedAmount = Math.round(Number(existing.rows[0].amount) * 100);
    const paidAmount = Number(payment.amount);

    if (expectedAmount !== paidAmount) {
      return res.sendStatus(400);
    }

    const updated = await pool.query(
      `UPDATE payment_transactions
       SET
         status='verified',
         verified_at=NOW(),
         metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{paystack}',
           $2::jsonb
         )
       WHERE reference=$1 AND status <> 'verified'
       RETURNING *`,
      [reference, JSON.stringify(payment)]
    );

    if (!updated.rows[0]) return res.sendStatus(200);

    if (updated.rows[0].order_id) {
      await pool.query(
        `
        UPDATE orders
        SET
          payment_status='verified',
          status='processing'
        WHERE id=$1
        `,
        [updated.rows[0].order_id]
      );

      try {
        const userRes = await pool.query(
          `
          SELECT
            u.name,
            u.email,
            o.total_amount,
            o.delivery_fee
          FROM orders o
          JOIN users u ON u.id = o.user_id
          WHERE o.id = $1
          `,
          [updated.rows[0].order_id]
        );

        if (userRes.rows.length > 0 && userRes.rows[0].email) {
          const itemsRes = await pool.query(
            `
            SELECT
              p.name,
              oi.quantity,
              oi.price,
              COALESCE(pv.weight, p.weight) AS weight
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            LEFT JOIN product_variants pv ON oi.variant_id = pv.id
            WHERE oi.order_id = $1
            `,
            [updated.rows[0].order_id]
          );

          await sendOrderConfirmationEmail(userRes.rows[0].email, {
            customerName: userRes.rows[0].name || "Customer",
            orderId: updated.rows[0].order_id,
            totalAmount: userRes.rows[0].total_amount,
            deliveryFee: userRes.rows[0].delivery_fee,
            items: itemsRes.rows,
          });
        }
      } catch (emailErr) {
        console.error("PAYSTACK WEBHOOK EMAIL ERROR:", emailErr.message);
      }
    }

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

router.post("/verify", async (req, res) => {
  const { reference, user_id } = req.body;

  if (!reference || !user_id) {
    return res.status(400).json({
      error: "Reference and user_id are required",
    });
  }

  try {
    await ensurePaymentGatewayTables();

    const existing = await pool.query(
      `SELECT * FROM payment_transactions
       WHERE reference = $1 AND user_id = $2`,
      [reference, user_id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "Payment transaction not found",
      });
    }

    const alreadyVerified = await pool.query(
      `SELECT status
       FROM payment_transactions
       WHERE reference = $1`,
      [reference]
    );

    if (alreadyVerified.rows[0]?.status === "verified") {
      return res.json({
        success: true,
        message: "Payment already verified.",
      });
    }

    let payment = null;

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.status(500).json({
        error: "PAYSTACK_SECRET_KEY is not configured.",
      });
    }

    try {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
          timeout: 10000,
        }
      );

      payment = response.data?.data || null;
    } catch (verifyErr) {
      console.error("PAYSTACK VERIFY ERROR:", verifyErr.response?.data || verifyErr.message);
      return res.status(502).json({
        error: "Payment verification service unavailable",
      });
    }

    if (!payment) {
      return res.status(400).json({
        error: "Payment could not be verified.",
      });
    }

    if (payment.status !== "success") {
      return res.status(400).json({
        error: "Payment was not successful.",
      });
    }

    if (payment.currency !== "NGN") {
      return res.status(400).json({
        error: "Invalid payment currency.",
      });
    }

    const tx = await pool.query(
      `SELECT amount
       FROM payment_transactions
       WHERE reference = $1
         AND user_id = $2`,
      [reference, user_id]
    );

    if (tx.rows.length === 0) {
      return res.status(404).json({
        error: "Transaction not found.",
      });
    }

    const expectedAmount = Math.round(Number(tx.rows[0].amount) * 100);
    const paidAmount = Number(payment.amount);

    if (expectedAmount !== paidAmount) {
      return res.status(400).json({
        error: "Payment amount mismatch.",
      });
    }

    const updated = await pool.query(
      `UPDATE payment_transactions
       SET
         status='verified',
         verified_at=NOW(),
         metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{paystack}',
           $2::jsonb
         )
       WHERE reference=$1 AND status <> 'verified'
       RETURNING *`,
      [
        reference,
        JSON.stringify(payment),
      ]
    );

    if (!updated.rows[0]) return res.json({ success: true, message: "Payment already verified." });

    if (updated.rows[0].order_id) {
      await pool.query(
        `
        UPDATE orders
        SET
          payment_status='verified',
          status='processing'
        WHERE id=$1
        `,
        [updated.rows[0].order_id]
      );
    }

    return res.json({
      success: true,
      transaction: updated.rows[0],
    });

  } catch (err) {
    console.error(
      "PAYSTACK VERIFY ERROR:",
      err.response?.data || err.message
    );

    return res.status(500).json({
      error: "Payment verification failed",
    });
  }
});

module.exports = router;
