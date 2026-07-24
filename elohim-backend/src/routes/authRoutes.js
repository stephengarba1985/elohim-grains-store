const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendVerificationEmail } = require("../utils/mail");

/* =========================
   REGISTER
========================= */
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        error: "Name, email, phone and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role === "bulk" ? "bulk" : "retail";

    // Check if email already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: "Email already registered.",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Save user
    await pool.query(
      `
      INSERT INTO users
      (
        name,
        email,
        phone,
        password,
        role,
        email_verified,
        verification_token
      )
      VALUES
      (
        $1,$2,$3,$4,$5,FALSE,$6
      )
      `,
      [
        name.trim(),
        normalizedEmail,
        phone.trim(),
        hashedPassword,
        normalizedRole,
        verificationToken,
      ]
    );

    // Build verification URL
    const verifyLink =
      `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    // Send verification email
    await sendVerificationEmail(normalizedEmail, verifyLink);

    return res.status(201).json({
      success: true,
      message:
        "Registration successful. Please check your email to verify your account.",
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);

    return res.status(500).json({
      error: "Registration failed.",
    });
  }
});

/* =========================
   VERIFY EMAIL
========================= */
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        error: "Verification token is required.",
      });
    }

    const result = await pool.query(
      `
      SELECT id
      FROM users
      WHERE verification_token = $1
      `,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: "Invalid or expired verification link.",
      });
    }

    await pool.query(
      `
      UPDATE users
      SET
        email_verified = TRUE,
        verification_token = NULL
      WHERE id = $1
      `,
      [result.rows[0].id]
    );

    return res.json({
      success: true,
      message: "Email verified successfully. You can now log in.",
    });

  } catch (err) {
    console.error("VERIFY EMAIL ERROR:", err);

    return res.status(500).json({
      error: "Email verification failed.",
    });
  }
});

/* =========================
   LOGIN
========================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `
      SELECT *
      FROM users
      WHERE LOWER(email) = LOWER($1)
      `,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: "User not found.",
      });
    }

    const user = result.rows[0];

    // Email verification check
    if (!user.email_verified) {
      return res.status(403).json({
        error: "Please verify your email before logging in.",
      });
    }

    // Password verification
    const validPassword = await bcrypt.compare(
      password,
      user.password
    );

    if (!validPassword) {
      return res.status(400).json({
        error: "Invalid password.",
      });
    }

    // Create JWT
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        is_admin: user.is_admin,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_admin: user.is_admin,
      },
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      error: "Login failed.",
    });
  }
});

module.exports = router;