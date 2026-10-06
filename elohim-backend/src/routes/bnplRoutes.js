const express = require("express");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

const VALID_FREQUENCIES = ["weekly", "monthly"];

const ensureBnplTables = async () => {
  await pool.query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS is_bnpl BOOLEAN DEFAULT FALSE
  `);

  await pool.query(`
    ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bnpl_agreements (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
      quantity INTEGER NOT NULL,
      frequency VARCHAR(20) NOT NULL DEFAULT 'weekly',
      duration_months INTEGER NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      amount_paid DECIMAL(10,2) DEFAULT 0,
      installment_amount DECIMAL(10,2) NOT NULL,
      credit_score INTEGER DEFAULT 600,
      guarantor_name VARCHAR(255) NOT NULL,
      guarantor_phone VARCHAR(50) NOT NULL,
      guarantor_relationship VARCHAR(100),
      status VARCHAR(30) DEFAULT 'active',
      next_due_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bnpl_payments (
      id SERIAL PRIMARY KEY,
      agreement_id INTEGER REFERENCES bnpl_agreements(id) ON DELETE CASCADE,
      amount DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const parsePositiveNumber = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) return null;

  return number;
};

const addPeriod = (date, frequency) => {
  const next = new Date(date);

  if (frequency === "monthly") {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setDate(next.getDate() + 7);
  }

  return next;
};

const getPeriods = (durationMonths, frequency) => {
  const months = Number(durationMonths || 0);
  return Math.max(1, frequency === "monthly" ? months : Math.ceil(months * 4));
};

const calculateEligibility = async (userId) => {
  const [orders, plans, bnpl] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS count FROM orders WHERE user_id=$1", [userId]),
    pool.query(
      "SELECT COUNT(*)::int AS count FROM grain_plans WHERE user_id=$1 AND COALESCE(status, '')='completed'",
      [userId]
    ),
    pool.query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='completed')::int AS completed,
        COUNT(*) FILTER (WHERE status='overdue')::int AS overdue
       FROM bnpl_agreements
       WHERE user_id=$1`,
      [userId]
    ),
  ]);

  const orderCount = Number(orders.rows?.[0]?.count || 0);
  const completedPlans = Number(plans.rows?.[0]?.count || 0);
  const bnplCompleted = Number(bnpl.rows?.[0]?.completed || 0);
  const bnplOverdue = Number(bnpl.rows?.[0]?.overdue || 0);
  const score =
    600 +
    Math.min(orderCount * 10, 120) +
    Math.min(completedPlans * 35, 140) +
    Math.min(bnplCompleted * 40, 120) -
    Math.min(bnplOverdue * 80, 240);

  const normalized = Math.max(300, Math.min(850, score));
  return { score: normalized, eligible: normalized >= 620 && bnplOverdue === 0, approved_limit: normalized >= 720 ? 250000 : normalized >= 620 ? 100000 : 0, rules: ["Completed order and savings-plan history", "No overdue BNPL agreement", "Approved limit based on recorded repayment behaviour", "Guarantor and terms acceptance required before purchase"] };
};

const getProductPrice = async (productId, variantId) => {
  const product = await pool.query(
    "SELECT id, price, stock_quantity FROM products WHERE id=$1",
    [productId]
  );

  if (product.rows.length === 0) {
    return { error: "Product not found", status: 404 };
  }

  if (!variantId) {
    return {
      price: Number(product.rows[0].price || 0),
      stock: Number(product.rows[0].stock_quantity || 0),
      product: product.rows[0],
    };
  }

  const variant = await pool.query(
    "SELECT id, product_id, price, stock FROM product_variants WHERE id=$1",
    [variantId]
  );

  if (variant.rows.length === 0) {
    return { error: "Variant not found", status: 404 };
  }

  if (Number(variant.rows[0].product_id) !== Number(productId)) {
    return { error: "Variant does not belong to selected product", status: 400 };
  }

  return {
    price: Number(variant.rows[0].price || 0),
    stock: Number(variant.rows[0].stock || 0),
    product: product.rows[0],
    variant: variant.rows[0],
  };
};

router.get("/user/:userId", async (req, res) => {
  try {
    await ensureBnplTables();

    const userId = req.params.userId;
    const eligibility = await calculateEligibility(userId);
    const agreements = await pool.query(
      `SELECT
        b.*,
        p.name AS product_name,
        pv.weight AS variant_weight
       FROM bnpl_agreements b
       JOIN products p ON b.product_id = p.id
       LEFT JOIN product_variants pv ON b.variant_id = pv.id
       WHERE b.user_id=$1
       ORDER BY b.id DESC`,
      [userId]
    );

    const reminders = agreements.rows
      .filter((item) => item.status === "active" && item.next_due_date)
      .map((item) => ({
        agreement_id: item.id,
        due_date: item.next_due_date,
        amount: item.installment_amount,
        overdue: new Date(item.next_due_date) < new Date(),
      }));

    res.json({ eligibility, agreements: agreements.rows, reminders });
  } catch (err) {
    console.error("BNPL FETCH ERROR:", err);
    res.status(500).json({ error: "Failed to load BNPL agreements" });
  }
});

router.get("/admin/overview", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensureBnplTables();

    const agreements = await pool.query(`
      SELECT
        b.*,
        p.name AS product_name,
        pv.weight AS variant_weight,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone
      FROM bnpl_agreements b
      JOIN users u ON b.user_id = u.id
      JOIN products p ON b.product_id = p.id
      LEFT JOIN product_variants pv ON b.variant_id = pv.id
      ORDER BY b.id DESC
    `);

    const totals = await pool.query(`
      SELECT
        COUNT(*)::int AS agreements,
        COUNT(*) FILTER (WHERE status='active')::int AS active,
        COUNT(*) FILTER (WHERE status='completed')::int AS completed,
        COALESCE(SUM(total_amount), 0) AS total_credit,
        COALESCE(SUM(amount_paid), 0) AS total_paid,
        COALESCE(SUM(total_amount - amount_paid), 0) AS outstanding,
        COALESCE(SUM(installment_amount) FILTER (WHERE status='active' AND next_due_date >= CURRENT_DATE AND next_due_date < CURRENT_DATE + INTERVAL '7 days'),0) AS due_this_week,
        COALESCE(SUM(total_amount-amount_paid) FILTER (WHERE status='active' AND next_due_date < CURRENT_DATE),0) AS overdue
      FROM bnpl_agreements
    `);

    const reminders = agreements.rows
      .filter((item) => item.status === "active" && item.next_due_date)
      .map((item) => ({
        agreement_id: item.id,
        user_name: item.user_name,
        user_email: item.user_email,
        product_name: item.product_name,
        due_date: item.next_due_date,
        amount: item.installment_amount,
        overdue: new Date(item.next_due_date) < new Date(),
      }));

    res.json({
      totals: totals.rows[0],
      agreements: agreements.rows,
      reminders,
    });
  } catch (err) {
    console.error("ADMIN BNPL ERROR:", err);
    res.status(500).json({ error: "Failed to load BNPL overview" });
  }
});

router.post("/", async (req, res) => {
  return res.status(410).json({ error: "New BNPL purchases are unavailable. Pay by OPay bank transfer at checkout." });
});

router.post("/:id/pay", async (req, res) => {
  const amount = parsePositiveNumber(req.body.amount);

  if (!amount) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }

  const client = await pool.connect();

  try {
    await ensureBnplTables();
    await client.query("BEGIN");

    const agreementRes = await client.query("SELECT * FROM bnpl_agreements WHERE id=$1", [
      req.params.id,
    ]);

    if (agreementRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "BNPL agreement not found" });
    }

    const agreement = agreementRes.rows[0];
    const balance = Math.max(Number(agreement.total_amount || 0) - Number(agreement.amount_paid || 0), 0);

    if (balance <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "BNPL agreement is already completed" });
    }

    if (amount > balance) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Amount exceeds outstanding balance" });
    }

    const newPaid = Number(agreement.amount_paid || 0) + amount;
    const isComplete = newPaid >= Number(agreement.total_amount || 0);
    const nextDueDate = isComplete ? null : addPeriod(new Date(), agreement.frequency);
    const completedAt = isComplete ? new Date() : null;

    await client.query(
      `UPDATE bnpl_agreements
       SET amount_paid=$1,
           status=$2,
           next_due_date=$3,
           completed_at=COALESCE($4::timestamp, completed_at)
       WHERE id=$5`,
      [
        newPaid,
        isComplete ? "completed" : "active",
        nextDueDate,
        completedAt,
        req.params.id,
      ]
    );

    await client.query(
      "INSERT INTO bnpl_payments (agreement_id, amount) VALUES ($1,$2)",
      [req.params.id, amount]
    );

    if (isComplete && agreement.order_id) {
      await client.query("UPDATE orders SET status='paid' WHERE id=$1", [agreement.order_id]);
    }

    await client.query("COMMIT");

    res.json({ message: "BNPL payment recorded", completed: isComplete });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("BNPL PAYMENT ERROR:", err);
    res.status(500).json({ error: "BNPL payment failed" });
  } finally {
    client.release();
  }
});

module.exports = router;
