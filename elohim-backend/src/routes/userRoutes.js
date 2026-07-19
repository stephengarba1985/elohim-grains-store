const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

/* =========================
   GET PROFILE
========================= */
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        id,
        name,
        email,
        phone,
        address,
        avatar,
        is_admin
      FROM users
      WHERE id = $1`,
      [req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

/* =========================
   UPDATE PROFILE
========================= */
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const { name, phone, address } = req.body;

    const result = await pool.query(
      `UPDATE users
       SET
         name = $1,
         phone = $2,
         address = $3
       WHERE id = $4
       RETURNING id,name,email,phone,address,avatar,is_admin`,
      [name, phone, address, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Profile update failed" });
  }
});

/* =========================
   CHANGE PASSWORD
========================= */
router.put("/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await pool.query(
      "SELECT password FROM users WHERE id=$1",
      [req.user.id]
    );

    const valid = await bcrypt.compare(
      currentPassword,
      user.rows[0].password
    );

    if (!valid) {
      return res.status(400).json({
        error: "Current password is incorrect",
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE users SET password=$1 WHERE id=$2",
      [hashed, req.user.id]
    );

    res.json({
      message: "Password updated successfully",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Password update failed",
    });
  }
});

module.exports = router;