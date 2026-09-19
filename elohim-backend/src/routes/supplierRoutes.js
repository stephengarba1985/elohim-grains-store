const express = require("express");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();
let setupPromise = null;
const ensureSupplierTables = async () => {
  if (setupPromise) return setupPromise;
  setupPromise = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY, business_name VARCHAR(255) NOT NULL, contact_name VARCHAR(255), phone VARCHAR(80), email VARCHAR(255), location VARCHAR(255),
      categories TEXT, payment_terms VARCHAR(255), status VARCHAR(30) NOT NULL DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS supplier_purchase_orders (
      id SERIAL PRIMARY KEY, supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL, reference VARCHAR(60) UNIQUE,
      product_name VARCHAR(255) NOT NULL, quantity NUMERIC(12,2) NOT NULL, unit_cost DECIMAL(12,2) NOT NULL, total_cost DECIMAL(12,2) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'draft', expected_date DATE, received_at TIMESTAMP, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
  })();
  try { await setupPromise; } catch (err) { setupPromise = null; throw err; }
};

router.use(async (req, res, next) => { try { await ensureSupplierTables(); next(); } catch (err) { console.error("SUPPLIER SETUP ERROR:", err); res.status(500).json({ error: "Supplier setup failed" }); } });

router.get("/admin/overview", verifyToken, isAdmin, async (req, res) => {
  try {
    const [suppliers, purchases, totals] = await Promise.all([
      pool.query("SELECT * FROM suppliers ORDER BY created_at DESC"),
      pool.query("SELECT p.*,s.business_name FROM supplier_purchase_orders p LEFT JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.created_at DESC"),
      pool.query("SELECT COUNT(*)::int AS suppliers, COALESCE(SUM(total_cost) FILTER (WHERE status IN ('ordered','received')),0) AS procurement_commitment, COUNT(*) FILTER (WHERE status='received')::int AS received_orders FROM supplier_purchase_orders")
    ]);
    res.json({ suppliers: suppliers.rows, purchases: purchases.rows, totals: totals.rows[0] });
  } catch (err) { console.error("SUPPLIER OVERVIEW ERROR:", err); res.status(500).json({ error: "Failed to load suppliers" }); }
});

router.post("/admin", verifyToken, isAdmin, async (req, res) => {
  try {
    const { business_name, contact_name, phone, email, location, categories, payment_terms } = req.body;
    if (!business_name) return res.status(400).json({ error: "Supplier business name is required" });
    const result = await pool.query("INSERT INTO suppliers (business_name,contact_name,phone,email,location,categories,payment_terms) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *", [business_name,contact_name||"",phone||"",email||"",location||"",categories||"",payment_terms||""]);
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error("CREATE SUPPLIER ERROR:", err); res.status(500).json({ error: "Failed to create supplier" }); }
});

router.post("/admin/purchase-orders", verifyToken, isAdmin, async (req, res) => {
  try {
    const { supplier_id, product_name, quantity, unit_cost, expected_date } = req.body;
    if (!supplier_id || !product_name || Number(quantity) <= 0 || Number(unit_cost) < 0) return res.status(400).json({ error: "Supplier, product, quantity and unit cost are required" });
    const total = Number(quantity) * Number(unit_cost);
    const created = await pool.query("INSERT INTO supplier_purchase_orders (supplier_id,product_name,quantity,unit_cost,total_cost,expected_date,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *", [supplier_id,product_name,quantity,unit_cost,total,expected_date||null,req.user.id]);
    const order = created.rows[0];
    const reference = `SP-${new Date().getFullYear()}-${String(order.id).padStart(6,"0")}`;
    const result = await pool.query("UPDATE supplier_purchase_orders SET reference=$1 WHERE id=$2 RETURNING *", [reference,order.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error("CREATE PURCHASE ORDER ERROR:", err); res.status(500).json({ error: "Failed to create supplier purchase order" }); }
});

router.patch("/admin/purchase-orders/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["draft","ordered","received","cancelled"].includes(status)) return res.status(400).json({ error: "Invalid purchase order status" });
    const result = await pool.query("UPDATE supplier_purchase_orders SET status=$1,received_at=CASE WHEN $1='received' THEN CURRENT_TIMESTAMP ELSE received_at END WHERE id=$2 RETURNING *", [status,req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Purchase order not found" });
    res.json(result.rows[0]);
  } catch (err) { console.error("UPDATE PURCHASE ORDER ERROR:", err); res.status(500).json({ error: "Failed to update purchase order" }); }
});
module.exports = router;
