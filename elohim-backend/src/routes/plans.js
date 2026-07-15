const express = require("express");
const pool = require("../config/db");
const {
  ensureWalletTables,
  getWalletBalance,
  insertTransaction,
} = require("./walletRoutes");

const router = express.Router();

const VALID_PAYMENT_FREQUENCIES = ["daily", "weekly", "monthly"];
const DEFAULT_PENALTY_RATE = 0.1;
const DEFAULT_REWARD_RATE = 0.02;

const planSelect = `
  SELECT
    gp.*,
    COALESCE(gp.amount_paid, 0) AS amount_paid,
    p.name AS product_name,
    pv.weight AS variant_weight,
    pv.price AS variant_price,
    u.name AS user_name,
    u.email AS user_email
  FROM grain_plans gp
  JOIN products p ON gp.product_id = p.id
  LEFT JOIN product_variants pv ON gp.variant_id = pv.id
  JOIN users u ON gp.user_id = u.id
`;

const ensurePlanColumns = async () => {
  await pool.query(`
    ALTER TABLE grain_plans
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS payment_frequency VARCHAR(20) DEFAULT 'monthly',
      ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'monthly',
      ADD COLUMN IF NOT EXISTS auto_debit_enabled BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS maturity_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS penalty_rate DECIMAL(5,4) DEFAULT 0.1,
      ADD COLUMN IF NOT EXISTS reward_rate DECIMAL(5,4) DEFAULT 0.02,
      ADD COLUMN IF NOT EXISTS reward_amount DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP
  `);

  await pool.query(`
    UPDATE grain_plans
    SET
      plan_type = COALESCE(plan_type, payment_frequency, 'monthly'),
      auto_debit_enabled = COALESCE(auto_debit_enabled, TRUE),
      maturity_date = COALESCE(maturity_date, created_at + (duration || ' months')::interval),
      status = COALESCE(status, 'active'),
      penalty_rate = COALESCE(penalty_rate, 0.1),
      reward_rate = COALESCE(reward_rate, 0.02),
      reward_amount = COALESCE(reward_amount, 0)
  `);
};

const getMaturityDate = (duration) => {
  const date = new Date();
  date.setMonth(date.getMonth() + Number(duration || 0));
  return date;
};

const getRewardRate = (duration) => {
  const months = Number(duration || 0);

  if (months >= 6) return 0.05;
  if (months >= 3) return 0.03;

  return DEFAULT_REWARD_RATE;
};

const buildPlanValues = async ({
  product_id,
  variant_id,
  quantity,
  duration,
  payment_frequency = "monthly",
  auto_debit_enabled = true,
}) => {
  if (!product_id || !quantity || !duration) {
    return { error: "Missing fields" };
  }

  const parsedProductId = Number(product_id);

  if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
    return { error: "Valid product is required" };
  }

  const normalizedFrequency = String(payment_frequency).toLowerCase();

  if (!VALID_PAYMENT_FREQUENCIES.includes(normalizedFrequency)) {
    return { error: "Invalid payment frequency" };
  }

  const product = await pool.query(
    "SELECT id, price FROM products WHERE id=$1",
    [parsedProductId]
  );

  if (product.rows.length === 0) {
    return { status: 404, error: "Product not found" };
  }

  let price = Number(product.rows[0].price);
  let normalizedVariantId = null;

  if (variant_id) {
    const variant = await pool.query(
      "SELECT id, product_id, price FROM product_variants WHERE id=$1",
      [variant_id]
    );

    if (variant.rows.length === 0) {
      return { status: 404, error: "Variant not found" };
    }

    if (Number(variant.rows[0].product_id) !== Number(product_id)) {
      return { error: "Variant does not belong to selected product" };
    }

    price = Number(variant.rows[0].price);
    normalizedVariantId = Number(variant.rows[0].id);
  }

  const planQuantity = Number(quantity);
  const planDuration = Number(duration);

  if (!Number.isFinite(planQuantity) || planQuantity <= 0) {
    return { error: "Quantity must be greater than zero" };
  }

  if (!Number.isFinite(planDuration) || planDuration <= 0) {
    return { error: "Duration must be greater than zero" };
  }

  return {
    productId: parsedProductId,
    variantId: normalizedVariantId,
    quantity: planQuantity,
    duration: planDuration,
    paymentFrequency: normalizedFrequency,
    planType: normalizedFrequency,
    autoDebitEnabled: Boolean(auto_debit_enabled),
    maturityDate: getMaturityDate(planDuration),
    penaltyRate: DEFAULT_PENALTY_RATE,
    rewardRate: getRewardRate(planDuration),
    totalAmount: price * planQuantity,
  };
};

const completePlanIfReady = async (client, plan, newAmount) => {
  const total = Number(plan.total_amount || 0);
  const alreadyRewarded = Number(plan.reward_amount || 0) > 0;

  if (newAmount < total) return { completed: false, rewardAmount: 0 };

  const rewardRate = Number(plan.reward_rate || getRewardRate(plan.duration));
  const rewardAmount = alreadyRewarded ? 0 : Math.round(total * rewardRate * 100) / 100;

  await client.query(
    `UPDATE grain_plans
     SET status='completed',
         completed_at=COALESCE(completed_at, NOW()),
         reward_amount=COALESCE(reward_amount, 0) + $1
     WHERE id=$2`,
    [rewardAmount, plan.id]
  );

  if (rewardAmount > 0) {
    await insertTransaction(client, {
      userId: plan.user_id,
      planId: plan.id,
      type: "reward_bonus",
      direction: "credit",
      amount: rewardAmount,
      note: "Reward bonus for completing grain savings plan",
    });
  }

  return { completed: true, rewardAmount };
};

/* =========================
   CREATE PLAN
========================= */
router.post("/", async (req, res) => {
  const {
    user_id,
    product_id,
    variant_id,
    quantity,
    duration,
    payment_frequency = "monthly",
    auto_debit_enabled = true,
  } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    await ensurePlanColumns();

    const values = await buildPlanValues({
      product_id,
      variant_id,
      quantity,
      duration,
      payment_frequency,
      auto_debit_enabled,
    });

    if (values.error) {
      return res.status(values.status || 400).json({ error: values.error });
    }

    const result = await pool.query(
      `INSERT INTO grain_plans 
      (user_id, product_id, variant_id, quantity, duration, payment_frequency, plan_type, auto_debit_enabled, maturity_date, penalty_rate, reward_rate, total_amount, amount_paid, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        user_id,
        values.productId,
        values.variantId,
        values.quantity,
        values.duration,
        values.paymentFrequency,
        values.planType,
        values.autoDebitEnabled,
        values.maturityDate,
        values.penaltyRate,
        values.rewardRate,
        values.totalAmount,
        0,
        "active",
      ]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create plan" });
  }
});

/* =========================
   GET ALL PLANS
========================= */
router.get("/", async (req, res) => {
  try {
    await ensurePlanColumns();

    const result = await pool.query(`
      ${planSelect}
      ORDER BY gp.id DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

/* =========================
   UPDATE PLAN
========================= */
router.put("/:id", async (req, res) => {
  const {
    product_id,
    variant_id,
    quantity,
    duration,
    payment_frequency,
    auto_debit_enabled = true,
  } = req.body;

  try {
    await ensurePlanColumns();

    const currentPlan = await pool.query(
      "SELECT * FROM grain_plans WHERE id=$1",
      [req.params.id]
    );

    if (currentPlan.rows.length === 0) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const values = await buildPlanValues({
      product_id,
      variant_id,
      quantity,
      duration,
      payment_frequency,
      auto_debit_enabled,
    });

    if (values.error) {
      return res.status(values.status || 400).json({ error: values.error });
    }

    const amountPaid = Number(currentPlan.rows[0].amount_paid || 0);

    if (values.totalAmount < amountPaid) {
      return res.status(400).json({
        error: "Plan total cannot be lower than the amount already paid",
      });
    }

    const result = await pool.query(
      `UPDATE grain_plans
       SET product_id=$1,
           variant_id=$2,
           quantity=$3,
           duration=$4,
           payment_frequency=$5,
           plan_type=$6,
           auto_debit_enabled=$7,
           maturity_date=$8,
           penalty_rate=$9,
           reward_rate=$10,
           total_amount=$11
       WHERE id=$12
       RETURNING *`,
      [
        values.productId,
        values.variantId,
        values.quantity,
        values.duration,
        values.paymentFrequency,
        values.planType,
        values.autoDebitEnabled,
        values.maturityDate,
        values.penaltyRate,
        values.rewardRate,
        values.totalAmount,
        req.params.id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update plan" });
  }
});

/* =========================
   DELETE PLAN
========================= */
router.delete("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensurePlanColumns();
    await ensureWalletTables();
    await client.query("BEGIN");

    const plan = await client.query(
      "SELECT * FROM grain_plans WHERE id=$1",
      [req.params.id]
    );

    if (plan.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Plan not found" });
    }

    const current = plan.rows[0];
    const paidAmount = Number(current.amount_paid || 0);
    const isMature = current.maturity_date
      ? new Date(current.maturity_date) <= new Date()
      : false;
    const penaltyRate = isMature ? 0 : Number(current.penalty_rate || DEFAULT_PENALTY_RATE);
    const penaltyAmount = Math.round(paidAmount * penaltyRate * 100) / 100;
    const refundAmount = Math.max(paidAmount - penaltyAmount, 0);

    if (refundAmount > 0) {
      await insertTransaction(client, {
        userId: current.user_id,
        planId: req.params.id,
        type: "refund",
        direction: "credit",
        amount: refundAmount,
        note: "Refund from removed grain plan",
      });
    }

    await client.query(
      "DELETE FROM grain_plans WHERE id=$1 RETURNING id",
      [req.params.id]
    );

    await client.query("COMMIT");

    res.json({
      message: "Plan removed",
      refund_amount: refundAmount,
      penalty_amount: penaltyAmount,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to remove plan" });
  } finally {
    client.release();
  }
});

/* =========================
   GET USER PLANS
========================= */
router.get("/user/:id", async (req, res) => {
  try {
    await ensurePlanColumns();

    const result = await pool.query(
      `${planSelect}
       WHERE gp.user_id=$1
       ORDER BY gp.id DESC`,
      [req.params.id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

/* =========================
   MAKE PAYMENT
========================= */
router.post("/:id/pay", async (req, res) => {
  const { amount, payment_source = "external" } = req.body;
  const paymentAmount = Number(amount);

  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }

  const client = await pool.connect();

  try {
    await ensureWalletTables();
    await client.query("BEGIN");

    const plan = await client.query(
      "SELECT * FROM grain_plans WHERE id=$1",
      [req.params.id]
    );

    if (plan.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Plan not found" });
    }

    const current = plan.rows[0];
    const balance = Math.max(
      Number(current.total_amount || 0) - Number(current.amount_paid || 0),
      0
    );

    if (balance <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Plan is already fully paid" });
    }

    if (paymentAmount > balance) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Amount exceeds plan balance" });
    }

    if (payment_source === "wallet") {
      const walletBalance = await getWalletBalance(current.user_id, client);

      if (paymentAmount > walletBalance) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Insufficient wallet balance" });
      }

      await insertTransaction(client, {
        userId: current.user_id,
        planId: req.params.id,
        type: "plan_payment",
        direction: "debit",
        amount: paymentAmount,
        note: "Auto-save payment for grain plan",
      });
    }

    const newAmount = Number(current.amount_paid || 0) + paymentAmount;

    await client.query(
      "UPDATE grain_plans SET amount_paid=$1 WHERE id=$2",
      [newAmount, req.params.id]
    );

    await client.query(
      `INSERT INTO grain_plan_payments (plan_id, amount)
       VALUES ($1,$2)`,
      [req.params.id, paymentAmount]
    );

    const completion = await completePlanIfReady(client, current, newAmount);

    await client.query("COMMIT");

    res.json({
      message: "Payment added",
      payment_source,
      completed: completion.completed,
      reward_amount: completion.rewardAmount,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Payment failed" });
  } finally {
    client.release();
  }
});

/* =========================
   AUTO DEBIT NEXT CONTRIBUTION
========================= */
router.post("/:id/auto-debit", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensurePlanColumns();
    await ensureWalletTables();
    await client.query("BEGIN");

    const plan = await client.query("SELECT * FROM grain_plans WHERE id=$1", [
      req.params.id,
    ]);

    if (plan.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Plan not found" });
    }

    const current = plan.rows[0];

    if (!current.auto_debit_enabled) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Auto debit is not enabled for this plan" });
    }

    if (current.status === "completed") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Plan is already completed" });
    }

    const total = Number(current.total_amount || 0);
    const paid = Number(current.amount_paid || 0);
    const balance = Math.max(total - paid, 0);
    const periodsPerMonth = { daily: 30, weekly: 4, monthly: 1 };
    const periodCount = Math.max(
      1,
      Math.ceil(Number(current.duration || 0) * periodsPerMonth[current.payment_frequency || "monthly"])
    );
    const contribution = Math.min(balance, Math.ceil(total / periodCount));
    const walletBalance = await getWalletBalance(current.user_id, client);

    if (contribution > walletBalance) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient wallet balance" });
    }

    await insertTransaction(client, {
      userId: current.user_id,
      planId: req.params.id,
      type: "plan_payment",
      direction: "debit",
      amount: contribution,
      note: "Scheduled auto debit for grain savings plan",
    });

    const newAmount = paid + contribution;

    await client.query("UPDATE grain_plans SET amount_paid=$1 WHERE id=$2", [
      newAmount,
      req.params.id,
    ]);

    await client.query(
      `INSERT INTO grain_plan_payments (plan_id, amount)
       VALUES ($1,$2)`,
      [req.params.id, contribution]
    );

    const completion = await completePlanIfReady(client, current, newAmount);

    await client.query("COMMIT");

    res.json({
      message: "Auto debit successful",
      amount: contribution,
      completed: completion.completed,
      reward_amount: completion.rewardAmount,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Auto debit failed" });
  } finally {
    client.release();
  }
});

module.exports = router;
