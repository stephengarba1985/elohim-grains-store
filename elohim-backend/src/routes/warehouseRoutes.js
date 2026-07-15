const express = require("express");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

let setupPromise = null;

const ensureWarehouseTables = async () => {
  if (setupPromise) return setupPromise;

  setupPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouse_holdings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        grain_name VARCHAR(255) NOT NULL,
        quantity_bags INTEGER NOT NULL,
        bag_weight VARCHAR(100),
        purchase_price DECIMAL(10,2) NOT NULL,
        current_market_price DECIMAL(10,2) NOT NULL,
        storage_fee_rate DECIMAL(5,2) DEFAULT 1.50,
        warehouse_location VARCHAR(255) DEFAULT 'Elohim Central Warehouse',
        status VARCHAR(30) DEFAULT 'stored',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sold_at TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouse_transactions (
        id SERIAL PRIMARY KEY,
        holding_id INTEGER REFERENCES warehouse_holdings(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        type VARCHAR(30) NOT NULL,
        quantity_bags INTEGER NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        plan_id INTEGER,
        type VARCHAR(30) NOT NULL,
        direction VARCHAR(10) NOT NULL,
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

const getWalletBalance = async (userId, client = pool) => {
  const result = await client.query(
    `SELECT COALESCE(SUM(
      CASE
        WHEN direction = 'credit' THEN amount
        WHEN direction = 'debit' THEN -amount
        ELSE 0
      END
    ), 0) AS balance
    FROM wallet_transactions
    WHERE user_id = $1`,
    [userId]
  );

  return Number(result.rows[0]?.balance || 0);
};

const holdingSelect = `
  SELECT
    h.*,
    u.name AS user_name,
    u.email AS user_email,
    p.image_url,
    (h.quantity_bags * h.purchase_price) AS purchase_value,
    (h.quantity_bags * h.current_market_price) AS market_value,
    ((h.quantity_bags * h.current_market_price) - (h.quantity_bags * h.purchase_price)) AS unrealized_profit
  FROM warehouse_holdings h
  LEFT JOIN users u ON u.id = h.user_id
  LEFT JOIN products p ON p.id = h.product_id
`;

router.use(async (req, res, next) => {
  try {
    await ensureWarehouseTables();
    next();
  } catch (err) {
    console.error("WAREHOUSE TABLE SETUP ERROR:", err);
    res.status(500).json({ error: "Warehouse setup failed" });
  }
});

router.get("/:userId", verifyToken, async (req, res) => {
  try {
    const requestedUserId = Number(req.params.userId);

    if (requestedUserId !== Number(req.user.id) && !req.user.is_admin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const holdingsRes = await pool.query(
      `${holdingSelect}
       WHERE h.user_id = $1
       ORDER BY h.created_at DESC`,
      [requestedUserId]
    );

    const transactionsRes = await pool.query(
      `SELECT t.*, h.grain_name
       FROM warehouse_transactions t
       LEFT JOIN warehouse_holdings h ON h.id = t.holding_id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC`,
      [requestedUserId]
    );

    res.json({
      holdings: holdingsRes.rows,
      transactions: transactionsRes.rows,
    });
  } catch (err) {
    console.error("FETCH WAREHOUSE ERROR:", err);
    res.status(500).json({ error: "Failed to load warehouse holdings" });
  }
});

router.post("/buy-store", verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { product_id, quantity_bags, warehouse_location } = req.body;
    const quantity = parsePositiveNumber(quantity_bags);

    if (!product_id || !quantity) {
      return res.status(400).json({ error: "Product and quantity are required" });
    }

    await client.query("BEGIN");

    const productRes = await client.query(
      "SELECT * FROM products WHERE id = $1",
      [product_id]
    );

    if (productRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Product not found" });
    }

    const product = productRes.rows[0];
    const availableStock = Number(product.stock_quantity || 0);

    if (availableStock < quantity) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Not enough stock available" });
    }

    await client.query(
      "UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2",
      [quantity, product.id]
    );

    const price = Number(product.price || 0);
    const totalAmount = price * quantity;
    const walletBalance = await getWalletBalance(req.user.id, client);

    if (walletBalance < totalAmount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Insufficient wallet balance",
        code: "INSUFFICIENT_WALLET_BALANCE",
        balance: walletBalance,
        required: totalAmount,
      });
    }

    await client.query(
      `INSERT INTO wallet_transactions
       (user_id, type, direction, amount, note)
       VALUES ($1, 'warehouse_purchase', 'debit', $2, $3)`,
      [
        req.user.id,
        totalAmount,
        `Smart warehouse purchase: ${quantity} bags of ${product.name}`,
      ]
    );

    const holdingRes = await client.query(
      `INSERT INTO warehouse_holdings
       (user_id, product_id, grain_name, quantity_bags, bag_weight, purchase_price,
        current_market_price, warehouse_location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.user.id,
        product.id,
        product.name,
        quantity,
        product.weight || "Standard",
        price,
        price,
        warehouse_location || "Elohim Central Warehouse",
      ]
    );

    const holding = holdingRes.rows[0];
    await client.query(
      `INSERT INTO warehouse_transactions
       (holding_id, user_id, type, quantity_bags, amount, note)
       VALUES ($1, $2, 'buy_store', $3, $4, $5)`,
      [
        holding.id,
        req.user.id,
        quantity,
        totalAmount,
        "Bought grains and stored in warehouse",
      ]
    );

    await client.query("COMMIT");
    res.json(holding);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("BUY STORE ERROR:", err);
    res.status(500).json({ error: "Failed to buy and store grains" });
  } finally {
    client.release();
  }
});

router.post("/:id/sell", verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const holdingRes = await client.query(
      "SELECT * FROM warehouse_holdings WHERE id = $1",
      [req.params.id]
    );

    if (holdingRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Warehouse holding not found" });
    }

    const holding = holdingRes.rows[0];

    if (Number(holding.user_id) !== Number(req.user.id) && !req.user.is_admin) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Access denied" });
    }

    if (holding.status !== "stored") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Only stored holdings can be sold" });
    }

    const amount = Number(holding.current_market_price || 0) * Number(holding.quantity_bags || 0);

    const updatedRes = await client.query(
      `UPDATE warehouse_holdings
       SET status = 'sale_requested',
           sold_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [holding.id]
    );

    await client.query(
      `INSERT INTO warehouse_transactions
       (holding_id, user_id, type, quantity_bags, amount, note)
       VALUES ($1, $2, 'sale_requested', $3, $4, $5)`,
      [
        holding.id,
        holding.user_id,
        holding.quantity_bags,
        amount,
        req.body.note || "Sale requested by user",
      ]
    );

    await client.query("COMMIT");
    res.json(updatedRes.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("SELL WAREHOUSE HOLDING ERROR:", err);
    res.status(500).json({ error: "Failed to request sale" });
  } finally {
    client.release();
  }
});

router.get("/admin/overview/all", verifyToken, isAdmin, async (req, res) => {
  try {
    const holdingsRes = await pool.query(`
      ${holdingSelect}
      ORDER BY h.created_at DESC
    `);

    const transactionsRes = await pool.query(`
      SELECT t.*, h.grain_name, u.name AS user_name
      FROM warehouse_transactions t
      LEFT JOIN warehouse_holdings h ON h.id = t.holding_id
      LEFT JOIN users u ON u.id = t.user_id
      ORDER BY t.created_at DESC
      LIMIT 50
    `);

    const totalsRes = await pool.query(`
      SELECT
        COUNT(*)::int AS holdings,
        COUNT(*) FILTER (WHERE status = 'stored')::int AS stored,
        COUNT(*) FILTER (WHERE status = 'sale_requested')::int AS sale_requests,
        COUNT(*) FILTER (WHERE status = 'sold')::int AS sold,
        COALESCE(SUM(quantity_bags), 0) AS total_bags,
        COALESCE(SUM(quantity_bags * purchase_price), 0) AS purchase_value,
        COALESCE(SUM(quantity_bags * current_market_price), 0) AS market_value
      FROM warehouse_holdings
    `);

    res.json({
      totals: totalsRes.rows[0] || {},
      holdings: holdingsRes.rows,
      transactions: transactionsRes.rows,
    });
  } catch (err) {
    console.error("FETCH WAREHOUSE ADMIN ERROR:", err);
    res.status(500).json({ error: "Failed to load warehouse admin overview" });
  }
});

router.patch("/admin/:id", verifyToken, isAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { status, current_market_price, storage_fee_rate } = req.body;
    const allowedStatuses = ["stored", "sale_requested", "sold", "released"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid holding status" });
    }

    await client.query("BEGIN");

    const existingRes = await client.query(
      "SELECT * FROM warehouse_holdings WHERE id = $1",
      [req.params.id]
    );

    if (existingRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Holding not found" });
    }

    const existing = existingRes.rows[0];
    const result = await client.query(
      `UPDATE warehouse_holdings
       SET status = COALESCE($1, status),
           current_market_price = COALESCE($2, current_market_price),
           storage_fee_rate = COALESCE($3, storage_fee_rate),
           sold_at = CASE WHEN $1 = 'sold' THEN CURRENT_TIMESTAMP ELSE sold_at END
       WHERE id = $4
       RETURNING *`,
      [
        status || null,
        current_market_price == null ? null : Number(current_market_price),
        storage_fee_rate == null ? null : Number(storage_fee_rate),
        req.params.id,
      ]
    );

    const updated = result.rows[0];

    if (status === "sold" && existing.status !== "sold") {
      const saleAmount =
        Number(updated.current_market_price || 0) *
        Number(updated.quantity_bags || 0);

      await client.query(
        `INSERT INTO warehouse_transactions
         (holding_id, user_id, type, quantity_bags, amount, note)
         VALUES ($1, $2, 'sold', $3, $4, $5)`,
        [
          updated.id,
          updated.user_id,
          updated.quantity_bags,
          saleAmount,
          "Warehouse holding sold and proceeds credited to wallet",
        ]
      );

      await client.query(
        `INSERT INTO wallet_transactions
         (user_id, type, direction, amount, note)
         VALUES ($1, 'warehouse_sale', 'credit', $2, $3)`,
        [
          updated.user_id,
          saleAmount,
          `Smart warehouse sale proceeds: ${updated.quantity_bags} bags of ${updated.grain_name}`,
        ]
      );
    }

    await client.query("COMMIT");
    res.json(updated);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("UPDATE WAREHOUSE HOLDING ERROR:", err);
    res.status(500).json({ error: "Failed to update warehouse holding" });
  } finally {
    client.release();
  }
});

module.exports = router;
