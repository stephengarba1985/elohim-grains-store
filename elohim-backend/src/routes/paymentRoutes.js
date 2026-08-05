const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const pool = require("../config/db");
const { ensurePaymentGatewayTables } = require("./paymentGatewayRoutes");
const { sendOrderConfirmationEmail } = require("../utils/mail");

const router = express.Router();

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
       WHERE reference=$1
       RETURNING *`,
      [reference, JSON.stringify(payment)]
    );

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
            o.total_amount
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
       WHERE reference=$1
       RETURNING *`,
      [
        reference,
        JSON.stringify(payment),
      ]
    );

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