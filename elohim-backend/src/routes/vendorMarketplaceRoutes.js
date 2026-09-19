const express = require("express");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();
const SUPPORTED_VENDOR_CATEGORIES = ["grains", "flour", "oil_seasoning", "spices", "fruits", "vegetables", "poultry_meat"];
const canonicalProductName = (value) => String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ");

let vendorSetupPromise = null;

const ensureVendorTables = async () => {
  if (vendorSetupPromise) return vendorSetupPromise;

  vendorSetupPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
        business_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        location VARCHAR(255),
        description TEXT,
        verification_status VARCHAR(30) DEFAULT 'pending',
        commission_rate DECIMAL(5,2) DEFAULT 7.50,
        rating_avg DECIMAL(3,2) DEFAULT 0,
        rating_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      ALTER TABLE vendor_profiles
        ADD COLUMN IF NOT EXISTS business_type VARCHAR(100),
        ADD COLUMN IF NOT EXISTS product_categories TEXT,
        ADD COLUMN IF NOT EXISTS payout_information TEXT,
        ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    `);
    await pool.query("UPDATE vendor_profiles SET verification_status='approved' WHERE verification_status='verified'");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_products (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER REFERENCES vendor_profiles(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        stock_quantity INTEGER DEFAULT 0,
        weight VARCHAR(255),
        image_url VARCHAR(500),
        category VARCHAR(120),
        description TEXT,
        wholesale_quantity INTEGER,
        wholesale_price DECIMAL(10,2),
        origin_source VARCHAR(255),
        status VARCHAR(30) DEFAULT 'pending_review',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`ALTER TABLE vendor_products
      ADD COLUMN IF NOT EXISTS category VARCHAR(120), ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS wholesale_quantity INTEGER, ADD COLUMN IF NOT EXISTS wholesale_price DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS origin_source VARCHAR(255), ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS catalog_name VARCHAR(255), ADD COLUMN IF NOT EXISTS packaging VARCHAR(120)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_ratings (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER REFERENCES vendor_profiles(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        vendor_order_id INTEGER UNIQUE,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        product_quality_rating INTEGER CHECK (product_quality_rating BETWEEN 1 AND 5),
        packaging_rating INTEGER CHECK (packaging_rating BETWEEN 1 AND 5),
        delivery_rating INTEGER CHECK (delivery_rating BETWEEN 1 AND 5),
        verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_orders (
        id SERIAL PRIMARY KEY,
        vendor_product_id INTEGER REFERENCES vendor_products(id) ON DELETE SET NULL,
        vendor_id INTEGER REFERENCES vendor_profiles(id) ON DELETE SET NULL,
        buyer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        quantity INTEGER NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        commission_amount DECIMAL(10,2) DEFAULT 0,
        delivery_address TEXT,
        delivery_status VARCHAR(30) DEFAULT 'pending',
        payment_status VARCHAR(30) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query("ALTER TABLE vendor_ratings ADD COLUMN IF NOT EXISTS vendor_order_id INTEGER UNIQUE, ADD COLUMN IF NOT EXISTS product_quality_rating INTEGER, ADD COLUMN IF NOT EXISTS packaging_rating INTEGER, ADD COLUMN IF NOT EXISTS delivery_rating INTEGER, ADD COLUMN IF NOT EXISTS verified_purchase BOOLEAN NOT NULL DEFAULT FALSE");
    await pool.query(`CREATE TABLE IF NOT EXISTS vendor_commission_rules (
      id SERIAL PRIMARY KEY, scope VARCHAR(30) NOT NULL, vendor_id INTEGER REFERENCES vendor_profiles(id) ON DELETE CASCADE,
      category VARCHAR(120), contract_name VARCHAR(255), rate DECIMAL(5,2) NOT NULL, active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await pool.query("ALTER TABLE vendor_orders ADD COLUMN IF NOT EXISTS commission_rate_applied DECIMAL(5,2)");
    await pool.query("ALTER TABLE vendor_orders ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(30) NOT NULL DEFAULT 'pending', ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP");
    await pool.query("ALTER TABLE vendor_orders ADD COLUMN IF NOT EXISTS escrow_status VARCHAR(30) NOT NULL DEFAULT 'not_applicable', ADD COLUMN IF NOT EXISTS escrow_note TEXT");
    await pool.query("ALTER TABLE vendor_orders ADD COLUMN IF NOT EXISTS order_reference VARCHAR(60), ADD COLUMN IF NOT EXISTS vendor_fulfilment_status VARCHAR(30) NOT NULL DEFAULT 'new', ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP, ADD COLUMN IF NOT EXISTS fulfilment_deadline TIMESTAMP");
    await pool.query("ALTER TABLE vendor_orders ADD COLUMN IF NOT EXISTS fulfilment_model VARCHAR(50) NOT NULL DEFAULT 'vendor_prepared_elohim_delivery'");
    await pool.query(`CREATE TABLE IF NOT EXISTS vendor_payouts (
      id SERIAL PRIMARY KEY, vendor_id INTEGER REFERENCES vendor_profiles(id) ON DELETE SET NULL,
      vendor_order_id INTEGER UNIQUE REFERENCES vendor_orders(id) ON DELETE CASCADE,
      gross_amount DECIMAL(10,2) NOT NULL, commission_amount DECIMAL(10,2) NOT NULL,
      other_charges DECIMAL(10,2) NOT NULL DEFAULT 0, settlement_amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending', paid_at TIMESTAMP, paid_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
  })();

  try {
    await vendorSetupPromise;
  } catch (err) {
    vendorSetupPromise = null;
    throw err;
  }
};

const parsePositiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const vendorSelect = `
  SELECT
    v.*,
    u.name AS owner_name,
    u.email AS owner_email,
    COUNT(DISTINCT p.id)::int AS product_count,
    COUNT(DISTINCT o.id)::int AS order_count,
    COUNT(DISTINCT o.id) FILTER (WHERE o.delivery_status = 'delivered')::int AS completed_order_count,
    COALESCE(SUM(o.total_amount), 0) AS gross_sales,
    COALESCE(SUM(o.commission_amount), 0) AS commission_earned
  FROM vendor_profiles v
  LEFT JOIN users u ON u.id = v.user_id
  LEFT JOIN vendor_products p ON p.vendor_id = v.id
  LEFT JOIN vendor_orders o ON o.vendor_id = v.id
`;

router.use(async (req, res, next) => {
  try {
    await ensureVendorTables();
    next();
  } catch (err) {
    console.error("VENDOR TABLE SETUP ERROR:", err);
    res.status(500).json({ error: "Vendor marketplace setup failed" });
  }
});

router.get("/", async (req, res) => {
  try {
    const vendorsRes = await pool.query(`
      ${vendorSelect}
      WHERE v.verification_status = 'approved'
      GROUP BY v.id, u.name, u.email
      ORDER BY v.rating_avg DESC, v.created_at DESC
    `);

    const productsRes = await pool.query(`
      SELECT
        p.*,
        v.business_name,
        v.location,
        v.verification_status,
        v.commission_rate,
        v.rating_avg,
        v.rating_count
      FROM vendor_products p
      JOIN vendor_profiles v ON v.id = p.vendor_id
      WHERE p.status = 'active' AND v.verification_status = 'approved'
      ORDER BY p.created_at DESC
    `);

    res.json({
      vendors: vendorsRes.rows,
      products: productsRes.rows,
    });
  } catch (err) {
    console.error("FETCH VENDORS ERROR:", err);
    res.status(500).json({ error: "Failed to load vendor marketplace" });
  }
});

router.get("/me", verifyToken, async (req, res) => {
  try {
    const vendorRes = await pool.query(
      "SELECT * FROM vendor_profiles WHERE user_id = $1",
      [req.user.id]
    );

    if (vendorRes.rows.length === 0) {
      return res.json({ vendor: null, products: [], orders: [] });
    }

    const vendor = vendorRes.rows[0];
    const productsRes = await pool.query(
      "SELECT * FROM vendor_products WHERE vendor_id = $1 ORDER BY created_at DESC",
      [vendor.id]
    );
    const ordersRes = await pool.query(
      `SELECT o.*, p.name AS product_name, u.name AS buyer_name, u.email AS buyer_email
       FROM vendor_orders o
       LEFT JOIN vendor_products p ON p.id = o.vendor_product_id
       LEFT JOIN users u ON u.id = o.buyer_user_id
       WHERE o.vendor_id = $1
       ORDER BY o.created_at DESC`,
      [vendor.id]
    );

    res.json({
      vendor,
      products: productsRes.rows,
      orders: ordersRes.rows,
    });
  } catch (err) {
    console.error("FETCH VENDOR ME ERROR:", err);
    res.status(500).json({ error: "Failed to load vendor profile" });
  }
});

router.get("/dashboard", verifyToken, async (req, res) => {
  try {
    const vendorRes = await pool.query("SELECT * FROM vendor_profiles WHERE user_id=$1", [req.user.id]);
    const vendor = vendorRes.rows[0];
    if (!vendor || vendor.verification_status !== "approved") return res.status(403).json({ error: "An approved vendor account is required" });
    const [today, totals, products, orders, reviews, payouts, sla] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total_amount),0) AS sales,COUNT(*)::int AS orders FROM vendor_orders WHERE vendor_id=$1 AND DATE(created_at)=CURRENT_DATE AND payment_status IN ('paid','escrow')`,[vendor.id]),
      pool.query(`SELECT COUNT(*) FILTER (WHERE delivery_status IN ('pending','processing','assigned'))::int AS pending_fulfilment, COALESCE(SUM(settlement_amount) FILTER (WHERE status='available'),0) AS available_payout FROM vendor_payouts WHERE vendor_id=$1`,[vendor.id]),
      pool.query("SELECT * FROM vendor_products WHERE vendor_id=$1 ORDER BY created_at DESC",[vendor.id]),
      pool.query(`SELECT o.*,p.name AS product_name,u.name AS buyer_name FROM vendor_orders o LEFT JOIN vendor_products p ON p.id=o.vendor_product_id LEFT JOIN users u ON u.id=o.buyer_user_id WHERE o.vendor_id=$1 ORDER BY o.created_at DESC LIMIT 50`,[vendor.id]),
      pool.query("SELECT * FROM vendor_ratings WHERE vendor_id=$1 ORDER BY created_at DESC LIMIT 20",[vendor.id]),
      pool.query("SELECT * FROM vendor_payouts WHERE vendor_id=$1 ORDER BY created_at DESC LIMIT 30",[vendor.id]),
      pool.query("SELECT COUNT(*)::int AS overdue FROM vendor_orders WHERE vendor_id=$1 AND fulfilment_deadline < CURRENT_TIMESTAMP AND vendor_fulfilment_status NOT IN ('ready','cancelled')", [vendor.id]),
    ]);
    res.json({ vendor, stats:{sales:today.rows[0].sales,orders:today.rows[0].orders,products:products.rows.length,pending_fulfilment:totals.rows[0].pending_fulfilment,available_payout:totals.rows[0].available_payout,overdue_orders:sla.rows[0].overdue}, products:products.rows, orders:orders.rows, reviews:reviews.rows, payouts:payouts.rows });
  } catch(err){ console.error("VENDOR DASHBOARD ERROR:",err);res.status(500).json({error:"Failed to load vendor dashboard"}); }
});

router.post("/register", verifyToken, async (req, res) => {
  try {
    const { business_name, phone, location, description, business_type, product_categories, payout_information } = req.body;

    if (!business_name) {
      return res.status(400).json({ error: "Business name is required" });
    }

    const result = await pool.query(
      `INSERT INTO vendor_profiles
       (user_id, business_name, phone, location, description, business_type, product_categories, payout_information)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id)
       DO UPDATE SET
         business_name = EXCLUDED.business_name,
         phone = EXCLUDED.phone,
         location = EXCLUDED.location,
         description = EXCLUDED.description,
         business_type = EXCLUDED.business_type,
         product_categories = EXCLUDED.product_categories,
         payout_information = EXCLUDED.payout_information,
         verification_status = 'pending'
       RETURNING *`,
      [
        req.user.id,
        business_name,
        phone || req.user.phone || "",
        location || "",
        description || "",
        business_type || "",
        product_categories || "",
        payout_information || "",
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("REGISTER VENDOR ERROR:", err);
    res.status(500).json({ error: "Vendor registration failed" });
  }
});

router.post("/products", verifyToken, async (req, res) => {
  try {
    const { name, price, stock_quantity, weight, image_url, category, description, wholesale_quantity, wholesale_price, origin_source, packaging } = req.body;
    const parsedPrice = parsePositiveNumber(price);
    const parsedStock = Number(stock_quantity || 0);

    if (!name || !parsedPrice || !SUPPORTED_VENDOR_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: "Product name, selling price and a supported category are required" });
    }

    const vendorRes = await pool.query(
      "SELECT * FROM vendor_profiles WHERE user_id = $1",
      [req.user.id]
    );

    if (vendorRes.rows.length === 0) {
      return res.status(404).json({ error: "Register as a vendor first" });
    }

    const vendor = vendorRes.rows[0];

    if (vendor.verification_status !== "approved") {
      return res.status(403).json({ error: "Your vendor application must be approved before products can be published" });
    }

    const result = await pool.query(
      `INSERT INTO vendor_products
       (vendor_id, name, price, stock_quantity, weight, image_url, category, description, wholesale_quantity, wholesale_price, origin_source, packaging, catalog_name, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending_review')
       RETURNING *`,
      [
        vendor.id,
        name,
        parsedPrice,
        Number.isFinite(parsedStock) ? parsedStock : 0,
        weight || "",
        image_url || "",
        category || "",
        description || "",
        Number(wholesale_quantity) || null,
        Number(wholesale_price) || null,
        origin_source || "",
        packaging || "",
        canonicalProductName(name),
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("CREATE VENDOR PRODUCT ERROR:", err);
    res.status(500).json({ error: "Failed to create vendor product" });
  }
});

router.patch("/admin/products/:id/review", verifyToken, isAdmin, async (req,res) => {
  try {
    const status = req.body.status;
    if (!["active","rejected","suspended"].includes(status)) return res.status(400).json({error:"Invalid product review status"});
    const submission = await pool.query("SELECT * FROM vendor_products WHERE id=$1",[req.params.id]);
    if (!submission.rows[0]) return res.status(404).json({error:"Product submission not found"});
    const product = submission.rows[0];
    if (status === "active" && (!product.category || !product.description || !product.weight || !product.packaging || !product.image_url)) return res.status(400).json({error:"Category, description, unit/weight, packaging and image are required before publishing"});
    const result = await pool.query("UPDATE vendor_products SET status=$1,reviewed_at=CURRENT_TIMESTAMP,reviewed_by=$2,catalog_name=COALESCE(catalog_name,$4) WHERE id=$3 RETURNING *",[status,req.user.id,req.params.id,canonicalProductName(product.name)]);
    if(!result.rows[0]) return res.status(404).json({error:"Product submission not found"});
    res.json(result.rows[0]);
  } catch(err){console.error("VENDOR PRODUCT REVIEW ERROR:",err);res.status(500).json({error:"Failed to review product"});}
});

router.get("/catalog-standards", async (req,res) => res.json({ categories: SUPPORTED_VENDOR_CATEGORIES, required_before_publish:["Product name","Category","Image","Description","Weight or unit","Packaging","Selling price","Available quantity"], prohibited:["Illegal, unsafe or unsupported products","Misleading product names","Duplicate catalogue names without a variant distinction"] }));

router.post("/orders", verifyToken, async (req, res) => {
  try {
    const { vendor_product_id, quantity, delivery_address } = req.body;
    const parsedQuantity = parsePositiveNumber(quantity);

    if (!vendor_product_id || !parsedQuantity) {
      return res.status(400).json({ error: "Product and quantity are required" });
    }

    const productRes = await pool.query(
      `SELECT p.*, v.commission_rate
       FROM vendor_products p
       JOIN vendor_profiles v ON v.id = p.vendor_id
       WHERE p.id = $1 AND p.status = 'active' AND v.verification_status = 'approved'`,
      [vendor_product_id]
    );

    if (productRes.rows.length === 0) {
      return res.status(404).json({ error: "Vendor product not found" });
    }

    const product = productRes.rows[0];
    const totalAmount = Number(product.price) * parsedQuantity;
    const rule = await pool.query(`SELECT rate FROM vendor_commission_rules WHERE active=TRUE AND ((scope='contract' AND vendor_id=$1) OR (scope='vendor' AND vendor_id=$1) OR (scope='category' AND category=$2) OR scope='default') ORDER BY CASE scope WHEN 'contract' THEN 3 WHEN 'vendor' THEN 2 WHEN 'category' THEN 1 ELSE 0 END DESC LIMIT 1`,[product.vendor_id,product.category]);
    const commissionRate = Number(rule.rows[0]?.rate ?? product.commission_rate ?? 0);
    const commissionAmount = totalAmount * (commissionRate / 100);

    const result = await pool.query(
      `INSERT INTO vendor_orders
       (vendor_product_id, vendor_id, buyer_user_id, quantity, total_amount, commission_amount, commission_rate_applied, delivery_address, fulfilment_deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP + INTERVAL '48 hours')
       RETURNING *`,
      [
        product.id,
        product.vendor_id,
        req.user.id,
        parsedQuantity,
        totalAmount,
        commissionAmount,
        commissionRate,
        delivery_address || "",
      ]
    );

    const order = result.rows[0];
    const reference = `EG-${new Date().getFullYear()}-${String(order.id).padStart(6, "0")}-V${order.vendor_id}`;
    const referenced = await pool.query("UPDATE vendor_orders SET order_reference=$1 WHERE id=$2 RETURNING *", [reference, order.id]);
    res.json(referenced.rows[0]);
  } catch (err) {
    console.error("CREATE VENDOR ORDER ERROR:", err);
    res.status(500).json({ error: "Failed to create vendor order" });
  }
});

router.patch("/orders/:id/fulfilment", verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["accepted", "preparing", "ready"];
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid fulfilment status" });
    const vendorRes = await pool.query("SELECT * FROM vendor_profiles WHERE user_id=$1 AND verification_status='approved'", [req.user.id]);
    if (!vendorRes.rows[0]) return res.status(403).json({ error: "An approved vendor account is required" });
    const vendor = vendorRes.rows[0];
    const transitions = { new: "accepted", accepted: "preparing", preparing: "ready" };
    const orderRes = await pool.query("SELECT * FROM vendor_orders WHERE id=$1 AND vendor_id=$2", [req.params.id, vendor.id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: "Vendor order not found" });
    if (transitions[order.vendor_fulfilment_status] !== status) return res.status(400).json({ error: "Complete the fulfilment steps in order" });
    const result = await pool.query("UPDATE vendor_orders SET vendor_fulfilment_status=$1, accepted_at=CASE WHEN $1='accepted' THEN CURRENT_TIMESTAMP ELSE accepted_at END WHERE id=$2 RETURNING *", [status, order.id]);
    res.json(result.rows[0]);
  } catch (err) { console.error("VENDOR FULFILMENT ERROR:", err); res.status(500).json({ error: "Failed to update fulfilment" }); }
});

router.get("/admin/commission-rules", verifyToken, isAdmin, async (req,res) => {
  const rules = await pool.query("SELECT r.*,v.business_name FROM vendor_commission_rules r LEFT JOIN vendor_profiles v ON v.id=r.vendor_id ORDER BY r.scope,r.id DESC");
  res.json(rules.rows);
});
router.post("/admin/commission-rules", verifyToken, isAdmin, async (req,res) => {
  const { scope,vendor_id,category,contract_name,rate }=req.body;
  if(!["default","category","vendor","contract"].includes(scope)||!Number.isFinite(Number(rate))||Number(rate)<0||Number(rate)>100) return res.status(400).json({error:"Valid commission rule required"});
  const result=await pool.query("INSERT INTO vendor_commission_rules (scope,vendor_id,category,contract_name,rate) VALUES ($1,$2,$3,$4,$5) RETURNING *",[scope,vendor_id||null,category||null,contract_name||null,rate]);res.json(result.rows[0]);
});

router.get("/ratings/eligible", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`SELECT o.id AS vendor_order_id,o.order_reference,p.name AS product_name,v.business_name
      FROM vendor_orders o JOIN vendor_products p ON p.id=o.vendor_product_id JOIN vendor_profiles v ON v.id=o.vendor_id
      LEFT JOIN vendor_ratings r ON r.vendor_order_id=o.id
      WHERE o.buyer_user_id=$1 AND o.delivery_status='delivered' AND r.id IS NULL ORDER BY o.created_at DESC`, [req.user.id]);
    res.json(result.rows);
  } catch (err) { console.error("ELIGIBLE RATINGS ERROR:", err); res.status(500).json({ error: "Failed to load reviewable orders" }); }
});

router.post("/ratings", verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { vendor_order_id, product_quality_rating, packaging_rating, delivery_rating, comment } = req.body;
    const scores = [product_quality_rating, packaging_rating, delivery_rating].map(Number);
    const parsedRating = Math.round((scores[0] + scores[1] + scores[2]) / 3);

    if (!vendor_order_id || scores.some((score) => !Number.isInteger(score) || score < 1 || score > 5)) {
      return res.status(400).json({ error: "A delivered order and all three rating scores are required" });
    }

    await client.query("BEGIN");
    const ratingRes = await client.query(
      `INSERT INTO vendor_ratings (vendor_id, user_id, vendor_order_id, rating, product_quality_rating, packaging_rating, delivery_rating, verified_purchase, comment)
       SELECT vendor_id, $1, id, $2, $3, $4, $5, TRUE, $6 FROM vendor_orders
       WHERE id=$7 AND buyer_user_id=$1 AND delivery_status='delivered'
       RETURNING *`,
      [req.user.id, parsedRating, scores[0], scores[1], scores[2], comment || "", vendor_order_id]
    );
    if (!ratingRes.rows[0]) { await client.query("ROLLBACK"); return res.status(403).json({ error: "Only the customer of a delivered order can review it" }); }

    await client.query(
      `UPDATE vendor_profiles v
       SET rating_avg = stats.rating_avg,
           rating_count = stats.rating_count
       FROM (
         SELECT vendor_id, ROUND(AVG(rating)::numeric, 2) AS rating_avg, COUNT(*)::int AS rating_count
         FROM vendor_ratings
         WHERE vendor_id = $1 AND verified_purchase = TRUE
         GROUP BY vendor_id
       ) stats
       WHERE v.id = stats.vendor_id`,
      [ratingRes.rows[0].vendor_id]
    );

    await client.query("COMMIT");
    res.json(ratingRes.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE VENDOR RATING ERROR:", err);
    res.status(500).json({ error: "Failed to rate vendor" });
  } finally {
    client.release();
  }
});

router.get("/admin/overview", verifyToken, isAdmin, async (req, res) => {
  try {
    const vendorsRes = await pool.query(`
      ${vendorSelect}
      GROUP BY v.id, u.name, u.email
      ORDER BY v.created_at DESC
    `);

    const productsRes = await pool.query(`
      SELECT p.*, v.business_name, v.verification_status
      FROM vendor_products p
      JOIN vendor_profiles v ON v.id = p.vendor_id
      ORDER BY p.created_at DESC
    `);

    const ordersRes = await pool.query(`
      SELECT o.*, p.name AS product_name, v.business_name, u.name AS buyer_name
      FROM vendor_orders o
      LEFT JOIN vendor_products p ON p.id = o.vendor_product_id
      LEFT JOIN vendor_profiles v ON v.id = o.vendor_id
      LEFT JOIN users u ON u.id = o.buyer_user_id
      ORDER BY o.created_at DESC
    `);

    const totalsRes = await pool.query(`
      SELECT
        COUNT(DISTINCT v.id)::int AS vendors,
        COUNT(DISTINCT p.id)::int AS products,
        COUNT(DISTINCT o.id)::int AS orders,
        COALESCE(SUM(o.total_amount), 0) AS gross_sales,
        COALESCE(SUM(o.commission_amount), 0) AS commission_earned
      FROM vendor_profiles v
      LEFT JOIN vendor_products p ON p.vendor_id = v.id
      LEFT JOIN vendor_orders o ON o.vendor_id = v.id
    `);

    res.json({
      totals: totalsRes.rows[0] || {},
      vendors: vendorsRes.rows,
      products: productsRes.rows,
      orders: ordersRes.rows,
    });
  } catch (err) {
    console.error("FETCH ADMIN VENDORS ERROR:", err);
    res.status(500).json({ error: "Failed to load vendor admin overview" });
  }
});

router.patch("/admin/vendors/:id/verification", verifyToken, isAdmin, async (req, res) => {
  try {
    const { status, commission_rate } = req.body;
    const allowedStatuses = ["pending", "under_review", "approved", "suspended", "rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid verification status" });
    }

    const result = await pool.query(
      `UPDATE vendor_profiles
       SET verification_status = $1,
           commission_rate = COALESCE($2, commission_rate),
           reviewed_at = CURRENT_TIMESTAMP,
           reviewed_by = $4
       WHERE id = $3
       RETURNING *`,
      [
        status,
        commission_rate == null ? null : Number(commission_rate),
        req.params.id,
        req.user.id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("UPDATE VENDOR VERIFICATION ERROR:", err);
    res.status(500).json({ error: "Failed to update vendor verification" });
  }
});

router.patch("/admin/orders/:id/delivery", verifyToken, isAdmin, async (req, res) => {
  try {
    const { delivery_status, payment_status, escrow_status, escrow_note, fulfilment_model } = req.body;
    const allowedDelivery = ["pending", "processing", "assigned", "in_transit", "delivered", "cancelled"];
    const allowedPayment = ["pending", "paid", "escrow", "failed", "refunded"];
    const allowedEscrow = ["not_applicable", "held_for_review", "released", "cancelled"];
    const allowedFulfilmentModels = ["fulfilled_by_elohim", "vendor_prepared_elohim_delivery"];

    if (delivery_status && !allowedDelivery.includes(delivery_status)) {
      return res.status(400).json({ error: "Invalid delivery status" });
    }

    if (payment_status && !allowedPayment.includes(payment_status)) {
      return res.status(400).json({ error: "Invalid payment status" });
    }
    if (escrow_status && !allowedEscrow.includes(escrow_status)) {
      return res.status(400).json({ error: "Invalid funds-hold status" });
    }
    if (fulfilment_model && !allowedFulfilmentModels.includes(fulfilment_model)) {
      return res.status(400).json({ error: "This delivery model is not available for launch operations" });
    }

    const result = await pool.query(
      `UPDATE vendor_orders
       SET delivery_status = COALESCE($1, delivery_status),
           payment_status = COALESCE($2, payment_status),
           escrow_status = COALESCE($3, escrow_status),
           escrow_note = COALESCE($4, escrow_note),
           fulfilment_model = COALESCE($5, fulfilment_model)
       WHERE id = $6
       RETURNING *`,
      [delivery_status || null, payment_status || null, escrow_status || null, escrow_note || null, fulfilment_model || null, req.params.id]
    );

    const order = result.rows[0];
    if (["paid", "escrow"].includes(order.payment_status) && order.delivery_status === "delivered") {
      if (order.payment_status === "escrow" && order.escrow_status === "held_for_review") {
        const released = await pool.query("UPDATE vendor_orders SET escrow_status='released' WHERE id=$1 RETURNING *", [order.id]);
        Object.assign(order, released.rows[0]);
      }
      const settlementAmount = Number(order.total_amount) - Number(order.commission_amount || 0);
      await pool.query(`INSERT INTO vendor_payouts (vendor_id,vendor_order_id,gross_amount,commission_amount,settlement_amount,status)
        VALUES ($1,$2,$3,$4,$5,'available') ON CONFLICT (vendor_order_id) DO UPDATE SET status='available',settlement_amount=EXCLUDED.settlement_amount`,[order.vendor_id,order.id,order.total_amount,order.commission_amount,settlementAmount]);
      await pool.query("UPDATE vendor_orders SET settlement_status='available' WHERE id=$1",[order.id]);
    }
    res.json(order);
  } catch (err) {
    console.error("UPDATE VENDOR ORDER DELIVERY ERROR:", err);
    res.status(500).json({ error: "Failed to update delivery status" });
  }
});

router.get("/admin/payouts", verifyToken, isAdmin, async (req,res) => {
  try {
    const result=await pool.query(`SELECT p.*,v.business_name,o.delivery_status,o.payment_status FROM vendor_payouts p JOIN vendor_profiles v ON v.id=p.vendor_id JOIN vendor_orders o ON o.id=p.vendor_order_id ORDER BY p.created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error("VENDOR PAYOUTS ERROR:", err);
    res.status(500).json({ error: "Failed to load vendor payouts" });
  }
});
router.post("/admin/payouts/:id/pay", verifyToken, isAdmin, async (req,res) => {
  try {
    const result=await pool.query("UPDATE vendor_payouts SET status='paid',paid_at=CURRENT_TIMESTAMP,paid_by=$1 WHERE id=$2 AND status='available' RETURNING *",[req.user.id,req.params.id]);
    if(!result.rows[0])return res.status(400).json({error:"Only available settlements can be paid"});
    await pool.query("UPDATE vendor_orders SET settlement_status='paid',settled_at=CURRENT_TIMESTAMP WHERE id=$1",[result.rows[0].vendor_order_id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("VENDOR PAYOUT ERROR:", err);
    res.status(500).json({ error: "Failed to complete vendor payout" });
  }
});

module.exports = router;
