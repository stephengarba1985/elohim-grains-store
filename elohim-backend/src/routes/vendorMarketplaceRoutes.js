const express = require("express");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

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
      CREATE TABLE IF NOT EXISTS vendor_products (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER REFERENCES vendor_profiles(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        stock_quantity INTEGER DEFAULT 0,
        weight VARCHAR(255),
        image_url VARCHAR(500),
        status VARCHAR(30) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_ratings (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER REFERENCES vendor_profiles(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
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
      WHERE v.verification_status = 'verified'
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
      WHERE p.status = 'active'
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

router.post("/register", verifyToken, async (req, res) => {
  try {
    const { business_name, phone, location, description } = req.body;

    if (!business_name) {
      return res.status(400).json({ error: "Business name is required" });
    }

    const result = await pool.query(
      `INSERT INTO vendor_profiles
       (user_id, business_name, phone, location, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id)
       DO UPDATE SET
         business_name = EXCLUDED.business_name,
         phone = EXCLUDED.phone,
         location = EXCLUDED.location,
         description = EXCLUDED.description,
         verification_status = 'pending'
       RETURNING *`,
      [
        req.user.id,
        business_name,
        phone || req.user.phone || "",
        location || "",
        description || "",
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
    const { name, price, stock_quantity, weight, image_url } = req.body;
    const parsedPrice = parsePositiveNumber(price);
    const parsedStock = Number(stock_quantity || 0);

    if (!name || !parsedPrice) {
      return res.status(400).json({ error: "Product name and price are required" });
    }

    const vendorRes = await pool.query(
      "SELECT * FROM vendor_profiles WHERE user_id = $1",
      [req.user.id]
    );

    if (vendorRes.rows.length === 0) {
      return res.status(404).json({ error: "Register as a vendor first" });
    }

    const vendor = vendorRes.rows[0];

    const result = await pool.query(
      `INSERT INTO vendor_products
       (vendor_id, name, price, stock_quantity, weight, image_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        vendor.id,
        name,
        parsedPrice,
        Number.isFinite(parsedStock) ? parsedStock : 0,
        weight || "",
        image_url || "",
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("CREATE VENDOR PRODUCT ERROR:", err);
    res.status(500).json({ error: "Failed to create vendor product" });
  }
});

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
       WHERE p.id = $1 AND p.status = 'active'`,
      [vendor_product_id]
    );

    if (productRes.rows.length === 0) {
      return res.status(404).json({ error: "Vendor product not found" });
    }

    const product = productRes.rows[0];
    const totalAmount = Number(product.price) * parsedQuantity;
    const commissionAmount = totalAmount * (Number(product.commission_rate || 0) / 100);

    const result = await pool.query(
      `INSERT INTO vendor_orders
       (vendor_product_id, vendor_id, buyer_user_id, quantity, total_amount, commission_amount, delivery_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        product.id,
        product.vendor_id,
        req.user.id,
        parsedQuantity,
        totalAmount,
        commissionAmount,
        delivery_address || "",
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("CREATE VENDOR ORDER ERROR:", err);
    res.status(500).json({ error: "Failed to create vendor order" });
  }
});

router.post("/ratings", verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { vendor_id, rating, comment } = req.body;
    const parsedRating = Number(rating);

    if (!vendor_id || !Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: "Valid vendor and rating are required" });
    }

    await client.query("BEGIN");
    const ratingRes = await client.query(
      `INSERT INTO vendor_ratings (vendor_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [vendor_id, req.user.id, parsedRating, comment || ""]
    );

    await client.query(
      `UPDATE vendor_profiles v
       SET rating_avg = stats.rating_avg,
           rating_count = stats.rating_count
       FROM (
         SELECT vendor_id, ROUND(AVG(rating)::numeric, 2) AS rating_avg, COUNT(*)::int AS rating_count
         FROM vendor_ratings
         WHERE vendor_id = $1
         GROUP BY vendor_id
       ) stats
       WHERE v.id = stats.vendor_id`,
      [vendor_id]
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
    const allowedStatuses = ["pending", "verified", "rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid verification status" });
    }

    const result = await pool.query(
      `UPDATE vendor_profiles
       SET verification_status = $1,
           commission_rate = COALESCE($2, commission_rate)
       WHERE id = $3
       RETURNING *`,
      [
        status,
        commission_rate == null ? null : Number(commission_rate),
        req.params.id,
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
    const { delivery_status, payment_status } = req.body;
    const allowedDelivery = ["pending", "processing", "assigned", "in_transit", "delivered", "cancelled"];
    const allowedPayment = ["pending", "paid", "escrow", "failed", "refunded"];

    if (delivery_status && !allowedDelivery.includes(delivery_status)) {
      return res.status(400).json({ error: "Invalid delivery status" });
    }

    if (payment_status && !allowedPayment.includes(payment_status)) {
      return res.status(400).json({ error: "Invalid payment status" });
    }

    const result = await pool.query(
      `UPDATE vendor_orders
       SET delivery_status = COALESCE($1, delivery_status),
           payment_status = COALESCE($2, payment_status)
       WHERE id = $3
       RETURNING *`,
      [delivery_status || null, payment_status || null, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("UPDATE VENDOR ORDER DELIVERY ERROR:", err);
    res.status(500).json({ error: "Failed to update delivery status" });
  }
});

module.exports = router;
