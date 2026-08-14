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
const tableExists = async (qualifiedName) => {
  const result = await pool.query(
    "SELECT to_regclass($1) AS exists",
    [qualifiedName]
  );

  return Boolean(result.rows[0]?.exists);
};

const columnExists = async (tableName, columnName) => {
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS exists`,
    [tableName, columnName]
  );

  return Boolean(result.rows[0]?.exists);
};

router.get('/', async (req, res) => {
  try {
    const productsTableExists = await tableExists("public.products");
    if (!productsTableExists) {
      return res.json([]);
    }

    const categoriesTableExists = await tableExists("public.categories");
    const productTypesTableExists = await tableExists("public.product_types");
    const variantsTableExists = await tableExists("public.product_variants");
    const hasCategoryIdColumn = await columnExists("products", "category_id");
    const hasProductTypeColumn = variantsTableExists && await columnExists("product_variants", "product_type_id");

    const productsResult = await pool.query(
      `SELECT id, name, description, COALESCE(image_url, image, '') AS image, price, stock_quantity, weight, ${hasCategoryIdColumn ? 'category_id' : 'NULL::integer AS category_id'}
       FROM products
       ORDER BY id`
    );

    const products = productsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      image: row.image || '',
      price: Number(row.price ?? 0),
      stock_quantity: Number(row.stock_quantity ?? 0),
      weight: row.weight || '',
      category: null,
      category_id: row.category_id ?? null,
      types: []
    }));

    if (categoriesTableExists && hasCategoryIdColumn) {
      const categoriesResult = await pool.query('SELECT id, name FROM categories');
      const categoryMap = Object.fromEntries(
        categoriesResult.rows.map((category) => [String(category.id), category.name])
      );

      for (const product of products) {
        if (product.category_id != null) {
          product.category = categoryMap[String(product.category_id)] || null;
        }
      }
    }

    if (productTypesTableExists) {
      const typesResult = await pool.query('SELECT * FROM product_types ORDER BY id');
      const productsById = Object.fromEntries(products.map((product) => [String(product.id), product]));

      for (const type of typesResult.rows) {
        const product = productsById[String(type.product_id)];
        if (!product) continue;

        const typeEntry = {
          id: type.id,
          name: type.name,
          variants: []
        };

        let variantsResult = [];

        if (hasProductTypeColumn) {
          variantsResult = await pool.query(
            'SELECT * FROM product_variants WHERE product_type_id = $1 ORDER BY id',
            [type.id]
          );
        }

        if (variantsResult.rows?.length === 0 && type.product_id != null) {
          variantsResult = await pool.query(
            'SELECT * FROM product_variants WHERE product_id = $1 ORDER BY id',
            [type.product_id]
          );
        }

        typeEntry.variants = variantsResult.rows?.map((variant) => ({
          id: variant.id,
          weight: variant.weight,
          price: Number(variant.price ?? 0),
          stock: Number(variant.stock ?? 0)
        })) || [];

        product.types.push(typeEntry);
      }
    }

    return res.json(products);

  } catch (err) {
    console.error("FETCH ERROR:", err);
    return res.status(500).json({ error: err.message });
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
  const client = await pool.connect();

  try {
    const productId = Number(req.params.id);

    await client.query("BEGIN");

    // Delete variants first
    await client.query(
      "DELETE FROM product_variants WHERE product_id = $1",
      [productId]
    );

    // Delete stock history
    await client.query(
      "DELETE FROM stock_history WHERE product_id = $1",
      [productId]
    );

    // Delete product
    await client.query(
      "DELETE FROM products WHERE id = $1",
      [productId]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Product deleted successfully",
    });

  } catch (err) {
    await client.query("ROLLBACK");

    console.error("DELETE PRODUCT ERROR:", err);

    res.status(500).json({
      error: "Failed to delete product",
    });

  } finally {
    client.release();
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

router.delete(
  "/:productId/variants/:variantId",
  verifyToken,
  isAdmin,
  async (req, res) => {
    const { productId, variantId } = req.params;

    try {
      await pool.query(
        "DELETE FROM product_variants WHERE id = $1 AND product_id = $2",
        [variantId, productId]
      );

      res.json({
        message: "Variant deleted successfully",
      });

    } catch (err) {
      console.error("DELETE VARIANT ERROR:", err);

      res.status(500).json({
        error: "Failed to delete variant",
      });
    }
  }
);
module.exports = router;
