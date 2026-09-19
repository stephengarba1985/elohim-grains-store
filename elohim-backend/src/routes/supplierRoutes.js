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
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL, product_name VARCHAR(255) NOT NULL, quantity NUMERIC(12,2) NOT NULL, unit_cost DECIMAL(12,2) NOT NULL, total_cost DECIMAL(12,2) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'draft', payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid', expected_date DATE, received_at TIMESTAMP, paid_at TIMESTAMP, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await pool.query("ALTER TABLE supplier_purchase_orders ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid', ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP");
    await pool.query(`CREATE TABLE IF NOT EXISTS stock_history (id SERIAL PRIMARY KEY, product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL, change NUMERIC NOT NULL, previous_stock NUMERIC NOT NULL, new_stock NUMERIC NOT NULL, reason VARCHAR(255), note TEXT, reference VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  })();
  try { await setupPromise; } catch (err) { setupPromise = null; throw err; }
};

router.use(async (req, res, next) => { try { await ensureSupplierTables(); next(); } catch (err) { console.error("SUPPLIER SETUP ERROR:", err); res.status(500).json({ error: "Supplier setup failed" }); } });

router.get("/admin/overview", verifyToken, isAdmin, async (req, res) => {
  try {
    const [suppliers, purchases, totals, products] = await Promise.all([
      pool.query("SELECT * FROM suppliers ORDER BY created_at DESC"),
      pool.query("SELECT p.*,s.business_name,pr.name AS catalog_product_name FROM supplier_purchase_orders p LEFT JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN products pr ON pr.id=p.product_id ORDER BY p.created_at DESC"),
      pool.query("SELECT COUNT(*)::int AS suppliers, COALESCE(SUM(total_cost) FILTER (WHERE status IN ('ordered','received')),0) AS procurement_commitment, COUNT(*) FILTER (WHERE status='received')::int AS received_orders, COALESCE(SUM(total_cost) FILTER (WHERE payment_status='unpaid'),0) AS unpaid_supplier_balance FROM supplier_purchase_orders"),
      pool.query("SELECT id,name,stock_quantity,cost_price FROM products ORDER BY name")
    ]);
    res.json({ suppliers: suppliers.rows, purchases: purchases.rows, products: products.rows, totals: totals.rows[0] });
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
    const { supplier_id, product_id, quantity, unit_cost, expected_date } = req.body;
    if (!supplier_id || !product_id || Number(quantity) <= 0 || Number(unit_cost) < 0) return res.status(400).json({ error: "Supplier, Elohim product, quantity and unit cost are required" });
    const product = await pool.query("SELECT id,name FROM products WHERE id=$1", [product_id]);
    if (!product.rows[0]) return res.status(404).json({ error: "Elohim inventory product not found" });
    const total = Number(quantity) * Number(unit_cost);
    const created = await pool.query("INSERT INTO supplier_purchase_orders (supplier_id,product_id,product_name,quantity,unit_cost,total_cost,expected_date,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *", [supplier_id,product_id,product.rows[0].name,quantity,unit_cost,total,expected_date||null,req.user.id]);
    const order = created.rows[0];
    const reference = `SP-${new Date().getFullYear()}-${String(order.id).padStart(6,"0")}`;
    const result = await pool.query("UPDATE supplier_purchase_orders SET reference=$1 WHERE id=$2 RETURNING *", [reference,order.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error("CREATE PURCHASE ORDER ERROR:", err); res.status(500).json({ error: "Failed to create supplier purchase order" }); }
});

router.patch("/admin/purchase-orders/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const { status, payment_status } = req.body;
    if (!["draft","ordered","received","cancelled"].includes(status)) return res.status(400).json({ error: "Invalid purchase order status" });
    if (payment_status && !["unpaid","part_paid","paid"].includes(payment_status)) return res.status(400).json({ error: "Invalid supplier payment status" });
    const result = await pool.query("UPDATE supplier_purchase_orders SET status=COALESCE($1,status),payment_status=COALESCE($2,payment_status),paid_at=CASE WHEN $2='paid' THEN CURRENT_TIMESTAMP ELSE paid_at END WHERE id=$3 RETURNING *", [status||null,payment_status||null,req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Purchase order not found" });
    res.json(result.rows[0]);
  } catch (err) { console.error("UPDATE PURCHASE ORDER ERROR:", err); res.status(500).json({ error: "Failed to update purchase order" }); }
});
router.post("/admin/purchase-orders/:id/receive", verifyToken, isAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const po = await client.query("SELECT * FROM supplier_purchase_orders WHERE id=$1 FOR UPDATE", [req.params.id]);
    const order = po.rows[0];
    if (!order) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Purchase order not found" }); }
    if (order.status === "received") { await client.query("ROLLBACK"); return res.status(400).json({ error: "Goods have already been received" }); }
    const product = await client.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [order.product_id]);
    if (!product.rows[0]) { await client.query("ROLLBACK"); return res.status(400).json({ error: "A valid Elohim inventory product is required before receipt" }); }
    const current = Number(product.rows[0].stock_quantity || 0), quantity = Number(order.quantity), next = current + quantity;
    const oldCost = Number(product.rows[0].cost_price || 0);
    const weightedCost = current > 0 ? ((current * oldCost) + (quantity * Number(order.unit_cost))) / next : Number(order.unit_cost);
    await client.query("UPDATE products SET stock_quantity=$1,cost_price=$2 WHERE id=$3", [next, weightedCost, order.product_id]);
    await client.query("INSERT INTO stock_history (product_id,admin_id,change,previous_stock,new_stock,reason,note,reference) VALUES ($1,$2,$3,$4,$5,'Supplier goods received',$6,$7)", [order.product_id,req.user.id,quantity,current,next,`Supplier cost ₦${order.unit_cost}`,order.reference]);
    const received = await client.query("UPDATE supplier_purchase_orders SET status='received',received_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *", [order.id]);
    await client.query("COMMIT"); res.json({ purchase_order: received.rows[0], inventory: { product_id: order.product_id, added: quantity, stock_quantity: next, cost_price: weightedCost } });
  } catch (err) { await client.query("ROLLBACK"); console.error("RECEIVE SUPPLIER GOODS ERROR:", err); res.status(500).json({ error: "Failed to receive supplier goods" }); } finally { client.release(); }
});
module.exports = router;
