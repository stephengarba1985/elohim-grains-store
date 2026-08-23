const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendVerificationEmail } = require("../utils/mail");
const { normalizePhone } = require("../utils/phone");

const resolveFrontendBaseUrl = (req) => {
  const requestOrigin = String(req.get("origin") || "").trim();
  if (/^https?:\/\//i.test(requestOrigin)) {
    return requestOrigin.replace(/\/+$/, "");
  }

  const configuredUrl = String(process.env.FRONTEND_URL || "").trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  const forwardedHost = req.get("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const forwardedProto = req.get("x-forwarded-proto");
  const proto = (forwardedProto || req.protocol || "https").split(",")[0].trim();

  if (host) {
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
};

const ensureUserEmailUniqueness = async () => {
  await pool.query(`
    WITH ranked_users AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY LOWER(email)
          ORDER BY
            CASE WHEN is_admin = TRUE THEN 0 ELSE 1 END DESC,
            email_verified DESC,
            created_at DESC,
            id DESC
        ) AS row_num
      FROM users
      WHERE email IS NOT NULL
    )
    DELETE FROM users
    WHERE id IN (
      SELECT id
      FROM ranked_users
      WHERE row_num > 1
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx
    ON users (LOWER(email));
  `);
};

const ensureAuthColumns = async () => {
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN,
      ADD COLUMN IF NOT EXISTS verification_token TEXT
  `);

  // Preserve access for legacy rows from older schemas.
  await pool.query(`
    UPDATE users
    SET email_verified = TRUE
    WHERE email_verified IS NULL
  `);

  await ensureUserEmailUniqueness();
};

const sendVerificationEmailSafely = async (email, verifyLink, userId) => {
  try {
    await sendVerificationEmail(email, verifyLink);
    return {
      emailSent: true,
      autoVerified: false,
    };
  } catch (error) {
    console.error("VERIFICATION EMAIL FAILED:", error);
    // IMPORTANT:
    // Never automatically verify a user's email when
    // the verification email could not be delivered.
    return {
      emailSent: false,
      autoVerified: false,
      error: "Verification email could not be sent.",
    };
  }
};

/* =========================
   REGISTER
========================= */
router.post("/register", async (req, res) => {
  try {
    await ensureAuthColumns();

    const { name, email, phone, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        error: "Name, email, phone and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone);
    const normalizedRole = role === "bulk" ? "bulk" : "retail";

    if (!normalizedPhone) {
      return res.status(400).json({
        error: "Phone number is invalid. Use a valid Nigerian number.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingUser = await client.query(
        `
        SELECT id, email_verified
        FROM users
        WHERE LOWER(email) = LOWER($1)
        ORDER BY
          CASE WHEN is_admin = TRUE THEN 0 ELSE 1 END DESC,
          email_verified DESC,
          created_at DESC,
          id DESC
        LIMIT 1
        FOR UPDATE
        `,
        [normalizedEmail]
      );

      if (existingUser.rows.length > 0) {
        const foundUser = existingUser.rows[0];

        if (foundUser.email_verified) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: "Email already registered.",
          });
        }

        const verificationToken = crypto.randomBytes(32).toString("hex");

        await client.query(
          `
          UPDATE users
          SET verification_token = $1
          WHERE id = $2
          `,
          [verificationToken, foundUser.id]
        );

        await client.query("COMMIT");

        const frontendBaseUrl = resolveFrontendBaseUrl(req);
        const verifyLink = `${frontendBaseUrl}/verify-email?token=${verificationToken}`;
        const emailResult = await sendVerificationEmailSafely(normalizedEmail, verifyLink, foundUser.id);

        return res.status(200).json({
          success: true,
          message: emailResult.autoVerified
            ? "This email is already registered. The account was reactivated because email delivery failed, so you can log in immediately."
            : "This email is already registered but not verified. A new verification email has been sent.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const verificationToken = crypto.randomBytes(32).toString("hex");

      const insertResult = await client.query(
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
        RETURNING id
        `,
        [
          name.trim(),
          normalizedEmail,
          normalizedPhone,
          hashedPassword,
          normalizedRole,
          verificationToken,
        ]
      );

      await client.query("COMMIT");

      const frontendBaseUrl = resolveFrontendBaseUrl(req);
      const verifyLink = `${frontendBaseUrl}/verify-email?token=${verificationToken}`;
      const emailResult = await sendVerificationEmailSafely(normalizedEmail, verifyLink, insertResult.rows[0].id);

      return res.status(201).json({
        success: true,
        message: emailResult.autoVerified
          ? "Registration successful. Your account is active and ready to log in because the verification email could not be delivered."
          : "Registration successful. Please check your email to verify your account.",
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error("REGISTER ERROR:", err);

    if (err.code === "23505") {
      const constraintName = String(err.constraint || "").toLowerCase();
      const errorDetail = String(err.detail || "").toLowerCase();

      if (constraintName.includes("phone") || errorDetail.includes("phone")) {
        return res.status(409).json({
          error: "Phone number is already in use.",
        });
      }

      if (
        constraintName.includes("email") ||
        errorDetail.includes("email") ||
        constraintName.includes("users_email_lower_unique_idx") ||
        errorDetail.includes("lower")
      ) {
        return res.status(409).json({
          error: "Email already registered.",
        });
      }
    }

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
    await ensureAuthColumns();

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
        error: "Invalid, expired, or already-used verification link.",
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
   RESEND VERIFICATION EMAIL
========================= */
router.post("/resend-verification", async (req, res) => {
  try {
    await ensureAuthColumns();

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email is required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `
      SELECT id, email, email_verified
      FROM users
      WHERE LOWER(email) = LOWER($1)
      ORDER BY
        CASE WHEN is_admin = TRUE THEN 0 ELSE 1 END DESC,
        email_verified DESC,
        created_at DESC,
        id DESC
      LIMIT 1
      `,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "No account found with this email.",
      });
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return res.status(400).json({
        error: "This email has already been verified.",
      });
    }

    // Generate a new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    await pool.query(
      `
      UPDATE users
      SET verification_token = $1
      WHERE id = $2
      `,
      [verificationToken, user.id]
    );

    const frontendBaseUrl = resolveFrontendBaseUrl(req);
    const verifyLink = `${frontendBaseUrl}/verify-email?token=${verificationToken}`;

    const emailResult = await sendVerificationEmailSafely(user.email, verifyLink, user.id);

    return res.json({
      success: true,
      message: emailResult.autoVerified
        ? "A new verification email could not be sent, but your account was reactivated for immediate access."
        : "A new verification email has been sent.",
    });

  } catch (err) {
    console.error("RESEND VERIFICATION ERROR:", err);

    return res.status(500).json({
      error: "Unable to resend verification email.",
    });
  }
});

/* =========================
   LOGIN
========================= */
router.post("/login", async (req, res) => {
  try {
    await ensureAuthColumns();

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
      ORDER BY
        CASE WHEN is_admin = TRUE THEN 0 ELSE 1 END DESC,
        email_verified DESC,
        created_at DESC,
        id DESC
      LIMIT 1
      `,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    // Email verification check
    // Admin accounts are often seeded manually and may not carry a verification flag.
    const isAdmin = Boolean(user.is_admin);
    const isEmailVerified = user.email_verified === true;

    if (!isAdmin && !isEmailVerified) {
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
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    // Create JWT
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        is_admin: user.is_admin,
      },
      process.env.JWT_SECRET || "elohim_123456",
      {
        expiresIn: "24h",
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