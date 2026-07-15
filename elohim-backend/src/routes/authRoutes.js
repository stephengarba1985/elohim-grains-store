const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

/* =========================
   REGISTER
========================= */
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    const normalizedRole = role === "bulk" ? "bulk" : "retail";

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, is_admin`,
      [name, email, phone, hashedPassword, normalizedRole]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

/* =========================
   LOGIN
========================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [
      email,
    ]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ error: "Invalid password" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_admin: user.is_admin,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

module.exports = router;
