const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { sendPasswordResetEmail } = require("../utils/mail");
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

const getUserColumns = async () => {
  const { rows } = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'`
  );

  return new Set(rows.map((row) => row.column_name));
};

const getProfileSelection = async () => {
  const columns = await getUserColumns();
  const selectColumns = ["id", "name", "email", "phone"];

  if (columns.has("address")) selectColumns.push("address");
  if (columns.has("avatar")) selectColumns.push("avatar");
  if (columns.has("is_admin")) selectColumns.push("is_admin");

  return { columns, selectColumns };
};

/* =========================
   GET PROFILE
========================= */
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const { columns, selectColumns } = await getProfileSelection();
    const result = await pool.query(
      `SELECT ${selectColumns.join(", ")} FROM users WHERE id = $1`,
      [req.user.id]
    );

    const profile = result.rows[0] || {};
    if (!columns.has("address")) profile.address = null;
    if (!columns.has("avatar")) profile.avatar = null;

    res.json(profile);
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
    const columns = await getUserColumns();
    const selectColumns = ["id", "name", "email", "phone"];

    if (columns.has("address")) selectColumns.push("address");
    if (columns.has("avatar")) selectColumns.push("avatar");
    if (columns.has("is_admin")) selectColumns.push("is_admin");

    const payload = {};
    if (typeof name !== "undefined") payload.name = name;
    if (typeof phone !== "undefined") payload.phone = phone;
    if (columns.has("address")) payload.address = address ?? null;

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: "No profile fields provided" });
    }

    const setClauses = Object.keys(payload).map((key, index) => `${key} = $${index + 1}`);
    const values = Object.values(payload);
    values.push(req.user.id);

    const sql = `UPDATE users
       SET ${setClauses.join(", ")}
       WHERE id = $${values.length}
       RETURNING ${selectColumns.join(", ")}`;

    const result = await pool.query(sql, values);

    const profile = result.rows[0] || {};
    if (!columns.has("address")) profile.address = null;
    if (!columns.has("avatar")) profile.avatar = null;

    res.json(profile);
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
/* =========================
   FORGOT PASSWORD
========================= */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    console.log("1. Request received");

    const result = await pool.query(
      "SELECT id, email FROM users WHERE email=$1",
      [email]
    );

    console.log("2. User lookup OK");

    if (result.rows.length === 0) {
      return res.json({ message: "Done" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 3600000);

    console.log("3. Token created");

    await pool.query(
      `UPDATE users
       SET reset_token=$1,
           reset_token_expiry=$2
       WHERE email=$3`,
      [token, expiry, email]
    );

    console.log("4. Database updated");

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    console.log("5. Sending email");

    await sendPasswordResetEmail(email, resetLink);

    console.log("6. Email sent");

    res.json({ message: "Success" });

  } catch (err) {
    console.error("FULL ERROR:");
    console.error(err);
    console.error(err.message);
    console.error(err.stack);

    res.status(500).json({
      error: err.message,
    });
  }
});
/* =========================
   RESET PASSWORD
========================= */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        error: "Token and password are required",
      });
    }

    const result = await pool.query(
      `SELECT id
       FROM users
       WHERE reset_token=$1
       AND reset_token_expiry > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: "Invalid or expired reset token",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE users
       SET password=$1,
           reset_token=NULL,
           reset_token_expiry=NULL
       WHERE id=$2`,
      [hashedPassword, result.rows[0].id]
    );

    res.json({
      message: "Password reset successfully",
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Password reset failed",
    });
  }
});

module.exports = router;