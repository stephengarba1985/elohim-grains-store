const express = require("express");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

let setupPromise = null;

const ensureInventoryFinanceTables = async () => {
  if (setupPromise) return setupPromise;

  setupPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_finance_applications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        grain_type VARCHAR(100) NOT NULL,
        quantity_bags INTEGER NOT NULL,
        bag_weight_kg DECIMAL(10,2) DEFAULT 50,
        estimated_value DECIMAL(10,2) NOT NULL,
        requested_amount DECIMAL(10,2) NOT NULL,
        approved_amount DECIMAL(10,2) DEFAULT 0,
        interest_rate DECIMAL(5,2) DEFAULT 4.50,
        duration_months INTEGER DEFAULT 3,
        storage_location TEXT,
        warehouse_receipt VARCHAR(255),
        collateral_status VARCHAR(30) DEFAULT 'pending_inspection',
        status VARCHAR(30) DEFAULT 'pending',
        due_date TIMESTAMP,
        disbursed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_finance_repayments (
        id SERIAL PRIMARY KEY,
        application_id INTEGER REFERENCES inventory_finance_applications(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        note TEXT,
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

const parsePositiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const calculateDueDate = (durationMonths) => {
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + Number(durationMonths || 3));
  return dueDate;
};

const applicationSelect = `
  SELECT
    a.*,
    u.name AS user_name,
    u.email AS user_email,
    u.phone AS user_phone,
    COALESCE(SUM(r.amount), 0) AS amount_repaid,
    GREATEST(
      (COALESCE(NULLIF(a.approved_amount, 0), a.requested_amount) *
        (1 + (COALESCE(a.interest_rate, 0) / 100))) - COALESCE(SUM(r.amount), 0),
      0
    ) AS outstanding_amount
  FROM inventory_finance_applications a
  LEFT JOIN users u ON u.id = a.user_id
  LEFT JOIN inventory_finance_repayments r ON r.application_id = a.id
`;

router.use(async (req, res, next) => {
  try {
    await ensureInventoryFinanceTables();
    next();
  } catch (err) {
    console.error("INVENTORY FINANCE TABLE SETUP ERROR:", err);
    res.status(500).json({ error: "Inventory finance setup failed" });
  }
});

router.get("/:userId", verifyToken, async (req, res) => {
  try {
    const requestedUserId = Number(req.params.userId);

    if (requestedUserId !== Number(req.user.id) && !req.user.is_admin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const applicationsRes = await pool.query(
      `${applicationSelect}
       WHERE a.user_id = $1
       GROUP BY a.id, u.name, u.email, u.phone
       ORDER BY a.created_at DESC`,
      [requestedUserId]
    );

    const repaymentsRes = await pool.query(
      `SELECT r.*, a.grain_type
       FROM inventory_finance_repayments r
       JOIN inventory_finance_applications a ON a.id = r.application_id
       WHERE a.user_id = $1
       ORDER BY r.created_at DESC`,
      [requestedUserId]
    );

    res.json({
      applications: applicationsRes.rows,
      repayments: repaymentsRes.rows,
    });
  } catch (err) {
    console.error("FETCH INVENTORY FINANCE ERROR:", err);
    res.status(500).json({ error: "Failed to load inventory financing" });
  }
});

router.post("/apply", verifyToken, async (req, res) => {
  try {
    const {
      grain_type,
      quantity_bags,
      bag_weight_kg,
      estimated_value,
      requested_amount,
      duration_months,
      storage_location,
      warehouse_receipt,
    } = req.body;

    const parsedQuantity = parsePositiveNumber(quantity_bags);
    const parsedValue = parsePositiveNumber(estimated_value);
    const parsedAmount = parsePositiveNumber(requested_amount);
    const parsedDuration = Number(duration_months || 3);
    const loanToValue = parsedValue ? parsedAmount / parsedValue : 1;

    if (!grain_type || !parsedQuantity || !parsedValue || !parsedAmount) {
      return res.status(400).json({
        error: "Grain type, quantity, estimated value, and requested amount are required",
      });
    }

    if (loanToValue > 0.7) {
      return res.status(400).json({
        error: "Requested amount cannot exceed 70% of collateral value",
      });
    }

    const result = await pool.query(
      `INSERT INTO inventory_finance_applications
       (user_id, grain_type, quantity_bags, bag_weight_kg, estimated_value, requested_amount,
        duration_months, storage_location, warehouse_receipt, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.user.id,
        grain_type,
        parsedQuantity,
        parsePositiveNumber(bag_weight_kg) || 50,
        parsedValue,
        parsedAmount,
        Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 3,
        storage_location || "",
        warehouse_receipt || "",
        calculateDueDate(parsedDuration),
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("CREATE INVENTORY FINANCE APPLICATION ERROR:", err);
    res.status(500).json({ error: "Inventory finance application failed" });
  }
});

router.post("/:id/repay", verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const amount = parsePositiveNumber(req.body.amount);

    if (!amount) {
      return res.status(400).json({ error: "Valid repayment amount is required" });
    }

    await client.query("BEGIN");

    const appRes = await client.query(
      "SELECT * FROM inventory_finance_applications WHERE id = $1",
      [req.params.id]
    );

    if (appRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Application not found" });
    }

    const application = appRes.rows[0];

    if (Number(application.user_id) !== Number(req.user.id) && !req.user.is_admin) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Access denied" });
    }

    const repaymentRes = await client.query(
      `INSERT INTO inventory_finance_repayments (application_id, amount, note)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [application.id, amount, req.body.note || "Inventory finance repayment"]
    );

    const totalsRes = await client.query(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM inventory_finance_repayments WHERE application_id = $1",
      [application.id]
    );

    const principal = Number(application.approved_amount || application.requested_amount || 0);
    const totalDue = principal * (1 + Number(application.interest_rate || 0) / 100);
    const totalPaid = Number(totalsRes.rows[0].total || 0);

    if (totalPaid >= totalDue) {
      await client.query(
        "UPDATE inventory_finance_applications SET status = 'repaid', collateral_status = 'released' WHERE id = $1",
        [application.id]
      );
    }

    await client.query("COMMIT");
    res.json(repaymentRes.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("INVENTORY FINANCE REPAYMENT ERROR:", err);
    res.status(500).json({ error: "Repayment failed" });
  } finally {
    client.release();
  }
});

router.get("/admin/overview/all", verifyToken, isAdmin, async (req, res) => {
  try {
    const applicationsRes = await pool.query(`
      ${applicationSelect}
      GROUP BY a.id, u.name, u.email, u.phone
      ORDER BY a.created_at DESC
    `);

    const totalsRes = await pool.query(`
      SELECT
        COUNT(*)::int AS applications,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'disbursed')::int AS disbursed,
        COUNT(*) FILTER (WHERE status = 'repaid')::int AS repaid,
        COALESCE(SUM(requested_amount), 0) AS requested_amount,
        COALESCE(SUM(approved_amount), 0) AS approved_amount
      FROM inventory_finance_applications
    `);

    const repaymentsRes = await pool.query(`
      SELECT
        r.*,
        a.grain_type,
        u.name AS user_name
      FROM inventory_finance_repayments r
      JOIN inventory_finance_applications a ON a.id = r.application_id
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY r.created_at DESC
      LIMIT 30
    `);

    res.json({
      totals: totalsRes.rows[0] || {},
      applications: applicationsRes.rows,
      repayments: repaymentsRes.rows,
    });
  } catch (err) {
    console.error("FETCH INVENTORY FINANCE ADMIN ERROR:", err);
    res.status(500).json({ error: "Failed to load inventory finance admin overview" });
  }
});

router.patch("/admin/:id/status", verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      status,
      approved_amount,
      interest_rate,
      collateral_status,
    } = req.body;

    const allowedStatuses = ["pending", "approved", "rejected", "disbursed", "repaid", "defaulted"];
    const allowedCollateral = ["pending_inspection", "verified", "locked", "released", "liquidated"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid application status" });
    }

    if (collateral_status && !allowedCollateral.includes(collateral_status)) {
      return res.status(400).json({ error: "Invalid collateral status" });
    }

    const currentRes = await pool.query(
      "SELECT * FROM inventory_finance_applications WHERE id = $1",
      [req.params.id]
    );

    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: "Application not found" });
    }

    const approvedAmount = approved_amount == null ? null : Number(approved_amount);
    const interestRate = interest_rate == null ? null : Number(interest_rate);
    const shouldSetDisbursedAt = status === "disbursed";

    const result = await pool.query(
      `UPDATE inventory_finance_applications
       SET status = COALESCE($1, status),
           approved_amount = COALESCE($2, approved_amount),
           interest_rate = COALESCE($3, interest_rate),
           collateral_status = COALESCE($4, collateral_status),
           disbursed_at = CASE WHEN $5 THEN CURRENT_TIMESTAMP ELSE disbursed_at END
       WHERE id = $6
       RETURNING *`,
      [
        status || null,
        Number.isFinite(approvedAmount) ? approvedAmount : null,
        Number.isFinite(interestRate) ? interestRate : null,
        collateral_status || null,
        shouldSetDisbursedAt,
        req.params.id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("UPDATE INVENTORY FINANCE STATUS ERROR:", err);
    res.status(500).json({ error: "Failed to update inventory finance status" });
  }
});

module.exports = router;
