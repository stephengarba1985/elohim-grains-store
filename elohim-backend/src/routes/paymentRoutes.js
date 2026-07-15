const express = require("express");
const axios = require("axios");
const pool = require("../config/db");

const router = express.Router();

router.post("/verify", async (req, res) => {
  const { reference, user_id } = req.body;

  try {
    /* =========================
       VERIFY PAYMENT
    ========================= */
    const verify = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = verify.data.data;

    if (data.status !== "success") {
      return res.status(400).json({
        error: "Payment not successful",
      });
    }

    /* =========================
       GET USER CART
    ========================= */
    const cartRes = await pool.query(
      "SELECT * FROM cart WHERE user_id = $1",
      [user_id]
    );

    const cartItems = cartRes.rows;

    if (cartItems.length === 0) {
      return res.status(400).json({
        error: "Cart is empty",
      });
    }

    /* =========================
       CREATE ORDER
    ========================= */
    const orderResult = await pool.query(
      "INSERT INTO orders (user_id, status, reference) VALUES ($1, $2, $3) RETURNING id",
      [user_id, "Paid", reference]
    );

    const orderId = orderResult.rows[0].id;

    /* =========================
       INSERT ORDER ITEMS
    ========================= */
    for (const item of cartItems) {
      await pool.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [
          orderId,
          item.product_id,
          item.quantity,
          item.price,
        ]
      );
    }

    /* =========================
       CLEAR CART
    ========================= */
    await pool.query(
      "DELETE FROM cart WHERE user_id = $1",
      [user_id]
    );

    /* =========================
       DONE
    ========================= */
    res.json({
      success: true,
      orderId,
    });

  } catch (err) {
    console.error("❌ PAYMENT ERROR:", err.response?.data || err.message);

    res.status(500).json({
      error: "Payment verification failed",
    });
  }
});

module.exports = router;