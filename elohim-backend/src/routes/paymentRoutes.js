const express = require("express");
const axios = require("axios");
const pool = require("../config/db");
const { ensurePaymentGatewayTables } = require("./paymentGatewayRoutes");

const router = express.Router();

router.post("/verify", async (req, res) => {
  const { reference, user_id } = req.body;

  if (!reference || !user_id) {
    return res.status(400).json({
      error: "Reference and user_id are required",
    });
  }

  try {
    await ensurePaymentGatewayTables();

    // Verify transaction with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const payment = response.data.data;

    if (!payment || payment.status !== "success") {
      return res.status(400).json({
        error: "Payment was not successful",
      });
    }

    // Find existing payment transaction
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

    // Update transaction
    const updated = await pool.query(
      `UPDATE payment_transactions
       SET
         status='verified',
         verified_at=NOW(),
         metadata = COALESCE(metadata,'{}'::jsonb) ||
           jsonb_build_object(
             'gateway','paystack',
             'gateway_status',$2,
             'paid_at',$3,
             'channel',$4,
             'authorization',$5
           )
       WHERE reference=$1
       RETURNING *`,
      [
        reference,
        payment.status,
        payment.paid_at,
        payment.channel,
        JSON.stringify(payment.authorization || {}),
      ]
    );

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