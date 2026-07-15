const express = require('express')
const router = express.Router()
const pool = require('../config/db')

// 🔐 SECURITY
const { verifyToken, isAdmin } = require('../middleware/auth')

/* =========================
   CREATE PRODUCT (ADMIN ONLY)
========================= */
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    let { name, price, stock_quantity, weight, image_url } = req.body

    // ✅ VALIDATION
    if (!name || price == null || stock_quantity == null) {
      return res.status(400).json({
        error: "Name, price and stock are required"
      })
    }

    // ✅ FORCE NUMBERS
    price = Number(price)
    stock_quantity = Number(stock_quantity)

    const result = await pool.query(
      `INSERT INTO products (name, price, stock_quantity, weight, image_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        name,
        price,
        stock_quantity,
        weight || "",
        image_url || ""
      ]
    )

    res.json(result.rows[0])

  } catch (err) {
    console.error("CREATE ERROR:", err)
    res.status(500).json({ error: err.message }) // ✅ SHOW REAL ERROR
  }
})

/* =========================
   GET ALL PRODUCTS
========================= */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.price,
        p.stock_quantity,
        p.weight,
        p.image_url,
        p.created_at,

        COALESCE(
          json_agg(
            json_build_object(
              'id', v.id,
              'weight', v.weight,
              'price', v.price,
              'stock', v.stock
            )
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'
        ) AS variants

      FROM products p
      LEFT JOIN product_variants v 
        ON p.id = v.product_id

      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("FETCH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
})

/* =========================
   GET SINGLE PRODUCT
========================= */
router.get('/:id', async (req, res) => {
  try {
    const productId = Number(req.params.id)

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "Valid product id is required" })
    }

    const columnRes = await pool.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'products' AND column_name = 'bulk_price')
          OR (table_name = 'product_variants' AND column_name = 'bulk_price')
        )
    `)
    const hasProductBulkPrice = columnRes.rows.some(
      (row) => row.table_name === 'products' && row.column_name === 'bulk_price'
    )
    const hasVariantBulkPrice = columnRes.rows.some(
      (row) => row.table_name === 'product_variants' && row.column_name === 'bulk_price'
    )

    const result = await pool.query(`
      SELECT
        p.id,
        p.name,
        p.price,
        ${hasProductBulkPrice ? 'p.bulk_price' : 'NULL::numeric'} AS bulk_price,
        p.stock_quantity,
        p.weight,
        p.image_url,
        p.created_at,

        COALESCE(
          json_agg(
            json_build_object(
              'id', v.id,
              'weight', v.weight,
              'price', v.price,
              'bulk_price', ${hasVariantBulkPrice ? 'v.bulk_price' : 'NULL::numeric'},
              'stock', v.stock
            )
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'
        ) AS variants

      FROM products p
      LEFT JOIN product_variants v
        ON p.id = v.product_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [productId])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" })
    }

    res.json(result.rows[0])

  } catch (err) {
    console.error("FETCH SINGLE PRODUCT ERROR:", err)
    res.status(500).json({ error: err.message })
  }
})

/* =========================
   UPDATE PRODUCT + STOCK HISTORY
========================= */
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const productId = Number(id)
    let { name, price, stock_quantity, weight, image_url } = req.body

    // ✅ FORCE NUMBERS
    price = Number(price)
    stock_quantity = Number(stock_quantity)

    const existing = await pool.query(
      'SELECT * FROM products WHERE id = $1',
      [productId]
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" })
    }

    const current = existing.rows[0]

    const updated = await pool.query(
      `UPDATE products
       SET name=$1, price=$2, stock_quantity=$3, weight=$4, image_url=$5
       WHERE id=$6
       RETURNING *`,
      [
        name,
        price,
        stock_quantity,
        weight || "",
        image_url || "",
        productId
      ]
    )

    const change = stock_quantity - Number(current.stock_quantity)

    if (change !== 0) {
      await pool.query(
        `INSERT INTO stock_history 
        (product_id, admin_id, change, previous_stock, new_stock)
        VALUES ($1, $2, $3, $4, $5)`,
        [
          productId,
          req.user.id,
          change,
          current.stock_quantity,
          stock_quantity,
        ]
      )
    }

    res.json(updated.rows[0])

  } catch (err) {
    console.error("UPDATE ERROR:", err)
    res.status(500).json({ error: err.message })
  }
})

/* =========================
   DELETE PRODUCT
========================= */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const productId = Number(id)

    await pool.query(
      'DELETE FROM products WHERE id = $1',
      [productId]
    )

    res.json({ message: "Product deleted" })
  } catch (err) {
    console.error("DELETE ERROR:", err)
    res.status(500).json({ error: err.message })
  }
})

/* =========================
   GET STOCK HISTORY
========================= */
router.get('/history/:product_id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { product_id } = req.params
    const productId = Number(product_id)

    const result = await pool.query(`
      SELECT stock_history.*, users.name
      FROM stock_history
      JOIN users ON stock_history.admin_id = users.id
      WHERE product_id = $1
      ORDER BY created_at DESC
    `, [productId])

    res.json(result.rows)

  } catch (err) {
    console.error("HISTORY ERROR:", err)
    res.status(500).json({ error: err.message })
  }
})

/* =========================
   GET VARIANTS FOR PRODUCT
========================= */
router.get('/:id/variants', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const productId = Number(id)

    const result = await pool.query(
      'SELECT * FROM product_variants WHERE product_id = $1 ORDER BY created_at DESC',
      [productId]
    )

    res.json(result.rows)

  } catch (err) {
    console.error("GET VARIANTS ERROR:", err)
    res.status(500).json({ error: err.message })
  }
});

/* =========================
   GET VARIANTS FOR PRODUCT (PUBLIC)
========================= */
router.get('/:id/variants/public', async (req, res) => {
  try {
    const { id } = req.params
    const productId = Number(id)

    const result = await pool.query(
      'SELECT * FROM product_variants WHERE product_id = $1 ORDER BY weight ASC',
      [productId]
    )

    res.json(result.rows)

  } catch (err) {
    console.error("GET VARIANTS PUBLIC ERROR:", err)
    res.status(500).json({ error: err.message })
  }
});

/* =========================
   CREATE PRODUCT WITH VARIANTS
========================= */
router.post('/full', verifyToken, isAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { name, image_url, variants } = req.body;

    if (!name || !variants || variants.length === 0) {
      return res.status(400).json({
        error: "Name and at least one variant required"
      });
    }

    await client.query("BEGIN");

    const productRes = await client.query(
      `INSERT INTO products (name, image_url)
       VALUES ($1, $2)
       RETURNING id`,
      [name, image_url || ""]
    );

    const productId = productRes.rows[0].id;

    for (const v of variants) {
      await client.query(
        `INSERT INTO product_variants (product_id, weight, price, stock)
         VALUES ($1, $2, $3, $4)`,
        [
          productId,
          v.weight,
          Number(v.price),
          Number(v.stock)
        ]
      );
    }

    await client.query("COMMIT");

    res.json({ message: "Product created", productId });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE FULL ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* =========================
   ADD VARIANT
========================= */
router.post('/:id/variants', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const productId = Number(id);
    const { weight, price, stock } = req.body;

    const result = await pool.query(
      `INSERT INTO product_variants (product_id, weight, price, stock)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [productId, weight, Number(price), Number(stock)]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error("ADD VARIANT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});


/* =========================
   UPDATE VARIANT STOCK
========================= */
router.put('/variants/:variant_id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { variant_id } = req.params;
    const { stock } = req.body;

    const result = await pool.query(
      `UPDATE product_variants
       SET stock = $1
       WHERE id = $2
       RETURNING *`,
      [Number(stock), variant_id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error("UPDATE VARIANT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE VARIANT
router.delete("/:productId/variants/:variantId", async (req, res) => {
  const { productId, variantId } = req.params;

  try {
    await pool.query(
      "DELETE FROM product_variants WHERE id = $1 AND product_id = $2",
      [variantId, productId]
    );

    res.json({ message: "Variant deleted successfully" });

  } catch (err) {
    console.error("❌ DELETE VARIANT ERROR:", err.message);
    res.status(500).json({ error: "Failed to delete variant" });
  }
});
module.exports = router;
