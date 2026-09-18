const express = require("express");
const pool = require("../config/db");
const { ensureWalletTables, getWalletBalance } = require("./walletRoutes");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/stats", async (req, res) => {
  try {
    const paymentStatusColumnRes = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'orders'
        AND column_name = 'payment_status'
    `);

    const hasPaymentStatusColumn = paymentStatusColumnRes.rows.length > 0;
    const realizedRevenueFilter = hasPaymentStatusColumn
      ? "(status IN ('paid', 'delivered') OR payment_status = 'verified')"
      : "status IN ('paid', 'delivered')";

    const [
      revenue,
      todayRevenue,
      orders,
      todayOrders,
      customers,
      newCustomers,
      products,
      riders,
      lowStock,
      delivered,
      pending,
      subscriptions,
    ] = await Promise.all([

      pool.query(`
        SELECT COALESCE(SUM(total_amount),0) AS revenue
        FROM orders
        WHERE ${realizedRevenueFilter}
      `),

      pool.query(`
        SELECT COALESCE(SUM(total_amount),0) AS revenue
        FROM orders
        WHERE DATE(created_at)=CURRENT_DATE
          AND ${realizedRevenueFilter}
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM orders
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM orders
        WHERE DATE(created_at)=CURRENT_DATE
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM users
        WHERE COALESCE(is_admin,false)=false
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM users
        WHERE COALESCE(is_admin,false)=false
          AND DATE(created_at)=CURRENT_DATE
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM products
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM riders
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM (
          SELECT
            p.id,
            GREATEST(
              COALESCE(p.stock_quantity, 0),
              COALESCE(SUM(pv.stock), 0)
            ) AS effective_stock
          FROM products p
          LEFT JOIN product_variants pv ON pv.product_id = p.id
          GROUP BY p.id, p.stock_quantity
        ) stock_view
        WHERE effective_stock > 0 AND effective_stock <= 10
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM orders
        WHERE status='delivered'
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM orders
        WHERE status!='delivered'
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM subscriptions
        WHERE status='active'
      `),

    ]);

    res.json({

      revenue: revenue.rows[0].revenue,

      todayRevenue: todayRevenue.rows[0].revenue,

      orders: orders.rows[0].total,

      todayOrders: todayOrders.rows[0].total,

      customers: customers.rows[0].total,

      newCustomers: newCustomers.rows[0].total,

      products: products.rows[0].total,

      riders: riders.rows[0].total,

      lowStock: lowStock.rows[0].total,

      delivered: delivered.rows[0].total,

      pending: pending.rows[0].total,

      subscriptions: subscriptions.rows[0].total

    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Failed to load dashboard"
    });

  }
});

router.get("/money-overview", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensureWalletTables();
    const tableExists = async (name) => Boolean((await pool.query("SELECT to_regclass($1) AS value", [name])).rows[0].value);
    const [hasPlans, hasBnpl, hasPayments] = await Promise.all([tableExists("public.grain_plans"), tableExists("public.bnpl_agreements"), tableExists("public.payment_transactions")]);
    const [sales, wallet, savings, bnpl, refunds] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total_amount),0) AS value FROM orders WHERE DATE(created_at)=CURRENT_DATE AND (payment_status='verified' OR status IN ('paid','delivered','processing'))`),
      pool.query(`SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount ELSE -amount END),0) AS value FROM wallet_transactions`),
      hasPlans ? pool.query("SELECT COALESCE(SUM(amount_paid),0) AS value FROM grain_plans WHERE status='active'") : { rows: [{ value: 0 }] },
      hasBnpl ? pool.query("SELECT COALESCE(SUM(total_amount-amount_paid),0) AS value FROM bnpl_agreements WHERE status='active'") : { rows: [{ value: 0 }] },
      hasPayments ? pool.query("SELECT COALESCE(SUM(amount),0) AS value FROM payment_transactions WHERE status='pending' AND channel='refund'") : { rows: [{ value: 0 }] },
    ]);
    res.json({ sales_today: sales.rows[0].value, wallet_funds_held: wallet.rows[0].value, savings_funds_held: savings.rows[0].value, outstanding_bnpl: bnpl.rows[0].value, pending_refunds: refunds.rows[0].value });
  } catch (err) { console.error("MONEY OVERVIEW ERROR:", err); res.status(500).json({ error: "Failed to load money overview" }); }
});

router.get("/transaction-ledger", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensureWalletTables();
    const tableExists = async (name) => Boolean((await pool.query("SELECT to_regclass($1) AS value", [name])).rows[0].value);
    const [hasPayments, hasPlanPayments] = await Promise.all([tableExists("public.payment_transactions"), tableExists("public.grain_plan_payments")]);
    const [wallet, payments, savings] = await Promise.all([
      pool.query(`SELECT wt.id, COALESCE(wt.reference, 'WALLET-' || wt.id) AS reference, wt.type, wt.amount, wt.direction, wt.note, wt.reason, wt.created_at, u.name AS customer_name, a.name AS administrator_name
        FROM wallet_transactions wt LEFT JOIN users u ON u.id=wt.user_id LEFT JOIN users a ON a.id=wt.administrator_id ORDER BY wt.created_at DESC LIMIT 150`),
      hasPayments ? pool.query(`SELECT id, reference, CASE WHEN channel='refund' THEN 'Refund' ELSE 'Product payment' END AS type, amount, status, created_at FROM payment_transactions ORDER BY created_at DESC LIMIT 150`) : { rows: [] },
      hasPlanPayments ? pool.query(`SELECT gpp.id, 'SAVE-' || gpp.id AS reference, 'Savings deposit' AS type, gpp.amount, gpp.created_at, u.name AS customer_name FROM grain_plan_payments gpp JOIN grain_plans gp ON gp.id=gpp.plan_id JOIN users u ON u.id=gp.user_id ORDER BY gpp.created_at DESC LIMIT 150`) : { rows: [] },
    ]);
    const ledger = [
      ...wallet.rows.map((x) => ({ ...x, type: x.type === 'adjustment' ? 'Wallet adjustment' : x.type, status: 'verified' })),
      ...payments.rows.map((x) => ({ ...x, direction: null })),
      ...savings.rows.map((x) => ({ ...x, status: 'verified', direction: 'credit' })),
    ].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ transactions: ledger });
  } catch (err) { console.error("LEDGER ERROR:", err); res.status(500).json({ error: "Failed to load transaction ledger" }); }
});

router.get("/analytics", verifyToken, isAdmin, async (req, res) => {
  try {
    const realized = "(o.payment_status='verified' OR o.status IN ('paid','processing','delivered'))";
    const [summary, periods, products, categories, channels, customers, delivery] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total_amount) FILTER (WHERE ${realized}),0) AS revenue, COUNT(*)::int AS orders, COALESCE(AVG(total_amount) FILTER (WHERE ${realized}),0) AS average_order_value FROM orders o`),
      pool.query(`SELECT DATE_TRUNC('day',created_at) AS day, COALESCE(SUM(total_amount) FILTER (WHERE ${realized}),0) AS revenue, COUNT(*)::int AS orders FROM orders o GROUP BY 1 ORDER BY 1 DESC LIMIT 30`),
      pool.query(`SELECT p.name, COALESCE(SUM(oi.quantity),0)::int AS units, COALESCE(SUM(oi.quantity*oi.price),0) AS revenue FROM order_items oi JOIN products p ON p.id=oi.product_id JOIN orders o ON o.id=oi.order_id WHERE ${realized} GROUP BY p.id,p.name ORDER BY revenue DESC LIMIT 10`),
      pool.query(`SELECT COALESCE(c.name,'Uncategorised') AS name, COALESCE(SUM(oi.quantity*oi.price),0) AS revenue FROM order_items oi JOIN products p ON p.id=oi.product_id JOIN orders o ON o.id=oi.order_id LEFT JOIN categories c ON c.id=p.category_id WHERE ${realized} GROUP BY c.name ORDER BY revenue DESC LIMIT 10`),
      pool.query(`SELECT CASE WHEN is_bulk THEN 'Bulk' WHEN is_subscription THEN 'Subscription' ELSE 'Retail' END AS name, COALESCE(SUM(total_amount) FILTER (WHERE ${realized}),0) AS revenue FROM orders o GROUP BY 1 ORDER BY 1`),
      pool.query(`SELECT CASE WHEN COUNT(o.id)=0 THEN 'New' WHEN COUNT(o.id)=1 THEN 'New' ELSE 'Returning' END AS name, COUNT(*)::int AS customers FROM users u LEFT JOIN orders o ON o.user_id=u.id WHERE COALESCE(u.is_admin,false)=false GROUP BY u.id`),
      pool.query(`SELECT COUNT(*) FILTER (WHERE status='delivered')::int AS delivered, COUNT(*) FILTER (WHERE status IN ('delivery_failed','failed'))::int AS failed, COUNT(*) FILTER (WHERE status='in_transit')::int AS out_for_delivery FROM orders`),
    ]);
    const customerSegments = customers.rows.reduce((acc, row) => { acc[row.name] = (acc[row.name] || 0) + Number(row.customers); return acc; }, {});
    res.json({ summary: summary.rows[0], daily: periods.rows.reverse(), top_products: products.rows, revenue_by_category: categories.rows, revenue_by_channel: channels.rows, customers: customerSegments, delivery: delivery.rows[0], gross_profit: null, gross_profit_note: "Add product cost prices to calculate gross profit." });
  } catch (err) { console.error("ANALYTICS ERROR:", err); res.status(500).json({ error: "Failed to load analytics" }); }
});

router.get("/profit-analytics", verifyToken, isAdmin, async (req, res) => {
  try {
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC");
    const [summary, products] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(oi.quantity*oi.price),0) AS revenue, COALESCE(SUM(oi.quantity*COALESCE(p.cost_price,0)),0) AS cost_of_goods, COALESCE(SUM(oi.quantity*(oi.price-COALESCE(p.cost_price,0))),0) AS gross_profit, COUNT(*) FILTER (WHERE p.cost_price IS NULL)::int AS uncosted_lines FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN products p ON p.id=oi.product_id WHERE o.payment_status='verified' OR o.status IN ('paid','processing','delivered')`),
      pool.query(`SELECT p.id,p.name,p.price,p.cost_price,COALESCE(SUM(oi.quantity) FILTER (WHERE o.id IS NOT NULL),0)::int AS units_sold,COALESCE(SUM(oi.quantity*oi.price) FILTER (WHERE o.id IS NOT NULL),0) AS revenue,COALESCE(SUM(oi.quantity*COALESCE(p.cost_price,0)) FILTER (WHERE o.id IS NOT NULL),0) AS cost_of_goods,COALESCE(SUM(oi.quantity*(oi.price-COALESCE(p.cost_price,0))) FILTER (WHERE o.id IS NOT NULL),0) AS gross_profit FROM products p LEFT JOIN order_items oi ON oi.product_id=p.id LEFT JOIN orders o ON o.id=oi.order_id AND (o.payment_status='verified' OR o.status IN ('paid','processing','delivered')) GROUP BY p.id,p.name,p.price,p.cost_price ORDER BY gross_profit DESC`),
    ]);
    res.json({ summary: summary.rows[0], products: products.rows, note: "Profit uses the current recorded product purchase cost. Record costs for every product for complete reporting." });
  } catch (err) { console.error("PROFIT ANALYTICS ERROR:", err); res.status(500).json({ error: "Failed to load profit analytics" }); }
});

router.post("/wallet-adjustments/:userId", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensureWalletTables();
    const amount = Number(req.body.amount);
    const direction = req.body.direction;
    const reason = String(req.body.reason || "").trim();
    if (!Number.isFinite(amount) || amount <= 0 || !["credit", "debit"].includes(direction) || !reason) return res.status(400).json({ error: "Amount, direction and reason are required" });
    const oldBalance = await getWalletBalance(req.params.userId);
    if (direction === "debit" && amount > oldBalance) return res.status(400).json({ error: "Adjustment exceeds available wallet balance" });
    const newBalance = direction === "credit" ? oldBalance + amount : oldBalance - amount;
    const reference = `ADJ-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    await pool.query(`INSERT INTO wallet_transactions (user_id, type, direction, amount, note, reason, reference, administrator_id)
      VALUES ($1,'adjustment',$2,$3,$4,$4,$5,$6)`, [req.params.userId, direction, amount, `Wallet adjustment: ${reason}. ${oldBalance} -> ${newBalance}`, reason, reference, req.user.id]);
    res.json({ reference, old_balance: oldBalance, adjustment: direction === "credit" ? amount : -amount, new_balance: newBalance });
  } catch (err) { console.error("WALLET ADJUSTMENT ERROR:", err); res.status(500).json({ error: "Failed to record wallet adjustment" }); }
});

module.exports = router;
