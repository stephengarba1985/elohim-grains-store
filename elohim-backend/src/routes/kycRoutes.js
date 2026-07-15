const express = require("express");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

let setupPromise = null;

const ensureKycTables = async () => {
  if (setupPromise) return setupPromise;

  setupPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS kyc_verifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        bvn_last4 VARCHAR(4),
        bvn_status VARCHAR(30) DEFAULT 'not_submitted',
        nin_last4 VARCHAR(4),
        nin_status VARCHAR(30) DEFAULT 'not_submitted',
        phone_status VARCHAR(30) DEFAULT 'not_verified',
        email_status VARCHAR(30) DEFAULT 'not_verified',
        overall_status VARCHAR(30) DEFAULT 'incomplete',
        risk_level VARCHAR(30) DEFAULT 'standard',
        submitted_at TIMESTAMP,
        reviewed_at TIMESTAMP,
        reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        admin_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS kyc_verification_codes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        channel VARCHAR(20) NOT NULL,
        code VARCHAR(10) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        consumed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  })();

  try {
    await setupPromise;
  } catch (err) {
    setupPromise = null;
    throw err;
  }
};

const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");

const maskLast4 = (value) => normalizeDigits(value).slice(-4);

const calculateOverallStatus = (record) => {
  const values = [
    record.bvn_status,
    record.nin_status,
    record.phone_status,
    record.email_status,
  ];

  if (values.every((status) => status === "verified")) return "verified";
  if (values.some((status) => status === "rejected")) return "needs_review";
  if (values.some((status) => status === "pending")) return "pending_review";
  return "incomplete";
};

const getOrCreateKyc = async (userId, client = pool) => {
  const existing = await client.query(
    "SELECT * FROM kyc_verifications WHERE user_id = $1",
    [userId]
  );

  if (existing.rows.length > 0) return existing.rows[0];

  const created = await client.query(
    `INSERT INTO kyc_verifications (user_id)
     VALUES ($1)
     RETURNING *`,
    [userId]
  );

  return created.rows[0];
};

const kycSelect = `
  SELECT
    k.*,
    u.name AS user_name,
    u.email AS user_email,
    u.phone AS user_phone,
    r.name AS reviewer_name
  FROM kyc_verifications k
  JOIN users u ON u.id = k.user_id
  LEFT JOIN users r ON r.id = k.reviewer_id
`;

router.use(async (req, res, next) => {
  try {
    await ensureKycTables();
    next();
  } catch (err) {
    console.error("KYC TABLE SETUP ERROR:", err);
    res.status(500).json({ error: "KYC setup failed" });
  }
});

router.get("/:userId", verifyToken, async (req, res) => {
  try {
    const requestedUserId = Number(req.params.userId);

    if (requestedUserId !== Number(req.user.id) && !req.user.is_admin) {
      return res.status(403).json({ error: "Access denied" });
    }

    await getOrCreateKyc(requestedUserId);

    const result = await pool.query(
      `${kycSelect}
       WHERE k.user_id = $1`,
      [requestedUserId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("FETCH KYC ERROR:", err);
    res.status(500).json({ error: "Failed to load KYC profile" });
  }
});

router.post("/submit-identity", verifyToken, async (req, res) => {
  try {
    const bvn = normalizeDigits(req.body.bvn);
    const nin = normalizeDigits(req.body.nin);

    if (bvn.length !== 11 || nin.length !== 11) {
      return res.status(400).json({
        error: "BVN and NIN must each be 11 digits",
      });
    }

    const current = await getOrCreateKyc(req.user.id);

    const updated = {
      ...current,
      bvn_status: "pending",
      nin_status: "pending",
    };

    const overallStatus = calculateOverallStatus(updated);

    const result = await pool.query(
      `UPDATE kyc_verifications
       SET bvn_last4 = $1,
           bvn_status = 'pending',
           nin_last4 = $2,
           nin_status = 'pending',
           overall_status = $3,
           submitted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4
       RETURNING *`,
      [maskLast4(bvn), maskLast4(nin), overallStatus, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("SUBMIT KYC IDENTITY ERROR:", err);
    res.status(500).json({ error: "Failed to submit identity verification" });
  }
});

router.post("/request-code", verifyToken, async (req, res) => {
  try {
    const channel = String(req.body.channel || "").toLowerCase();

    if (!["phone", "email"].includes(channel)) {
      return res.status(400).json({ error: "Channel must be phone or email" });
    }

    const destination =
      channel === "phone" ? req.user.phone || "" : req.user.email || "";

    if (!destination) {
      return res.status(400).json({ error: `No ${channel} found on account` });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO kyc_verification_codes
       (user_id, channel, code, destination, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, channel, code, destination, expiresAt]
    );

    res.json({
      message: "Verification code generated",
      channel,
      destination,
      dev_code: code,
    });
  } catch (err) {
    console.error("REQUEST KYC CODE ERROR:", err);
    res.status(500).json({ error: "Failed to generate verification code" });
  }
});

router.post("/confirm-code", verifyToken, async (req, res) => {
  try {
    const channel = String(req.body.channel || "").toLowerCase();
    const code = String(req.body.code || "").trim();

    if (!["phone", "email"].includes(channel) || !code) {
      return res.status(400).json({ error: "Channel and code are required" });
    }

    const codeRes = await pool.query(
      `SELECT *
       FROM kyc_verification_codes
       WHERE user_id = $1
         AND channel = $2
         AND code = $3
         AND consumed_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.id, channel, code]
    );

    if (codeRes.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired verification code" });
    }

    await pool.query(
      "UPDATE kyc_verification_codes SET consumed_at = CURRENT_TIMESTAMP WHERE id = $1",
      [codeRes.rows[0].id]
    );

    const current = await getOrCreateKyc(req.user.id);
    const updated = {
      ...current,
      [`${channel}_status`]: "verified",
    };
    const overallStatus = calculateOverallStatus(updated);

    const result = await pool.query(
      `UPDATE kyc_verifications
       SET ${channel}_status = 'verified',
           overall_status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING *`,
      [overallStatus, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("CONFIRM KYC CODE ERROR:", err);
    res.status(500).json({ error: "Failed to confirm verification code" });
  }
});

router.get("/admin/overview/all", verifyToken, isAdmin, async (req, res) => {
  try {
    const records = await pool.query(`
      ${kycSelect}
      ORDER BY k.updated_at DESC, k.created_at DESC
    `);

    const totals = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE overall_status = 'verified')::int AS verified,
        COUNT(*) FILTER (WHERE overall_status = 'pending_review')::int AS pending_review,
        COUNT(*) FILTER (WHERE overall_status = 'needs_review')::int AS needs_review,
        COUNT(*) FILTER (WHERE phone_status = 'verified')::int AS phone_verified,
        COUNT(*) FILTER (WHERE email_status = 'verified')::int AS email_verified
      FROM kyc_verifications
    `);

    res.json({
      totals: totals.rows[0] || {},
      records: records.rows,
    });
  } catch (err) {
    console.error("FETCH KYC ADMIN ERROR:", err);
    res.status(500).json({ error: "Failed to load KYC overview" });
  }
});

router.patch("/admin/:userId", verifyToken, isAdmin, async (req, res) => {
  try {
    const allowed = ["not_submitted", "not_verified", "pending", "verified", "rejected"];
    const { bvn_status, nin_status, phone_status, email_status, risk_level, admin_note } = req.body;

    for (const status of [bvn_status, nin_status, phone_status, email_status]) {
      if (status && !allowed.includes(status)) {
        return res.status(400).json({ error: "Invalid KYC status" });
      }
    }

    const current = await getOrCreateKyc(req.params.userId);
    const nextRecord = {
      ...current,
      bvn_status: bvn_status || current.bvn_status,
      nin_status: nin_status || current.nin_status,
      phone_status: phone_status || current.phone_status,
      email_status: email_status || current.email_status,
    };
    const overallStatus = calculateOverallStatus(nextRecord);

    const result = await pool.query(
      `UPDATE kyc_verifications
       SET bvn_status = COALESCE($1, bvn_status),
           nin_status = COALESCE($2, nin_status),
           phone_status = COALESCE($3, phone_status),
           email_status = COALESCE($4, email_status),
           risk_level = COALESCE($5, risk_level),
           admin_note = COALESCE($6, admin_note),
           overall_status = $7,
           reviewer_id = $8,
           reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $9
       RETURNING *`,
      [
        bvn_status || null,
        nin_status || null,
        phone_status || null,
        email_status || null,
        risk_level || null,
        admin_note || null,
        overallStatus,
        req.user.id,
        req.params.userId,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("UPDATE KYC ADMIN ERROR:", err);
    res.status(500).json({ error: "Failed to update KYC record" });
  }
});

module.exports = router;
