import express from "express";
import axios from "axios";

const router = express.Router();

router.post("/verify", async (req, res) => {
  const { reference, user_id } = req.body;

  try {
    // 🔥 VERIFY WITH PAYSTACK
    const verify = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = verify.data.data;

    // ❌ PAYMENT FAILED
    if (data.status !== "success") {
      return res.status(400).json({
        error: "Payment not successful",
      });
    }

    // ✅ PAYMENT VERIFIED
    // 👉 CREATE ORDER HERE
    const orderId = Date.now(); // replace with DB logic

    return res.json({
      success: true,
      orderId,
    });

  } catch (err) {
    console.error("VERIFY ERROR:", err.response?.data || err.message);

    res.status(500).json({
      error: "Payment verification failed",
    });
  }
});

export default router;