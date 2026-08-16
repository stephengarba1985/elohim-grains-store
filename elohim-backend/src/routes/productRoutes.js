const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const { verifyToken, isAdmin } = require("../middleware/auth");

/* =========================================================
   CATALOG DATABASE SAFETY
   Adds only missing optional columns.
   Existing data is NOT deleted.
========================================================= */

const ensureCatalogColumns = async () => {
  await pool.query(`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS category_id INTEGER,
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS image TEXT,
      ADD COLUMN IF NOT EXISTS slug VARCHAR(255),
      ADD COLUMN IF NOT EXISTS bulk_price NUMERIC
  `);

  await pool.query(`
    ALTER TABLE product_variants
      ADD COLUMN IF NOT EXISTS product_type_id INTEGER,
      ADD COLUMN IF NOT EXISTS bulk_price NUMERIC,
      ADD COLUMN IF NOT EXISTS image_url TEXT
  `);

  await pool.query(`
    ALTER TABLE product_types
      ADD COLUMN IF NOT EXISTS origin VARCHAR(255),
      ADD COLUMN IF NOT EXISTS brand VARCHAR(255),
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS image TEXT,
      ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT TRUE
  `);
};

/* =========================================================
   HELPERS
========================================================= */

const tableExists = async (qualifiedName) => {
  const result = await pool.query(
    "SELECT to_regclass($1) AS exists",
    [qualifiedName]
  );

  return Boolean(result.rows[0]?.exists);
};

const columnExists = async (tableName, columnName) => {
  const result = await pool.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    ) AS exists
    `,
    [tableName, columnName]
  );

  return Boolean(result.rows[0]?.exists);
};

const slugify = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const parseNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
};

/* =========================================================
   CATEGORY
========================================================= */

/* GET CATEGORIES */
router.get("/categories", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM categories
      ORDER BY name ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("GET CATEGORIES ERROR:", err);

    res.status(500).json({
      error: "Failed to load categories",
    });
  }
});

/* CREATE CATEGORY */
router.post(
  "/categories",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const {
        name,
        slug,
        description,
        image,
        status = true,
      } = req.body;

      if (!name?.trim()) {
        return res.status(400).json({
          error: "Category name is required",
        });
      }

      const categorySlug = slugify(slug || name);

      const result = await pool.query(
        `
        INSERT INTO categories
          (name, slug, description, image, status)
        VALUES
          ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          name.trim(),
          categorySlug,
          description || "",
          image || "",
          Boolean(status),
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("CREATE CATEGORY ERROR:", err);

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

/* UPDATE CATEGORY */
router.put(
  "/categories/:id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        name,
        slug,
        description,
        image,
        status,
      } = req.body;

      if (!name?.trim()) {
        return res.status(400).json({
          error: "Category name is required",
        });
      }

      const result = await pool.query(
        `
        UPDATE categories
        SET
          name = $1,
          slug = $2,
          description = $3,
          image = $4,
          status = $5
        WHERE id = $6
        RETURNING *
        `,
        [
          name.trim(),
          slugify(slug || name),
          description || "",
          image || "",
          status !== undefined ? Boolean(status) : true,
          id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Category not found",
        });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("UPDATE CATEGORY ERROR:", err);

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

/* DELETE CATEGORY */
router.delete(
  "/categories/:id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      const products = await pool.query(
        `
        SELECT COUNT(*)::int AS count
        FROM products
        WHERE category_id = $1
        `,
        [id]
      );

      if (products.rows[0].count > 0) {
        return res.status(400).json({
          error:
            "Cannot delete category because products are still assigned to it.",
        });
      }

      const result = await pool.query(
        `
        DELETE FROM categories
        WHERE id = $1
        RETURNING *
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Category not found",
        });
      }

      res.json({
        success: true,
        message: "Category deleted successfully",
      });
    } catch (err) {
      console.error("DELETE CATEGORY ERROR:", err);

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

/* =========================================================
   CREATE PRODUCT
========================================================= */

router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensureCatalogColumns();

    let {
      name,
      category_id,
      description,
      price,
      bulk_price,
      stock_quantity,
      weight,
      image_url,
      image,
      slug,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        error: "Product name is required",
      });
    }

    price = parseNumber(price);
    bulk_price =
      bulk_price === "" || bulk_price == null
        ? null
        : parseNumber(bulk_price);

    stock_quantity = parseNumber(stock_quantity);

    const productSlug = slugify(slug || name);

    const result = await pool.query(
      `
      INSERT INTO products
        (
          name,
          category_id,
          description,
          price,
          bulk_price,
          stock_quantity,
          weight,
          image_url,
          image,
          slug
        )
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
      `,
      [
        name.trim(),
        category_id || null,
        description || "",
        price,
        bulk_price,
        stock_quantity,
        weight || "",
        image_url || image || "",
        image || image_url || "",
        productSlug,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("CREATE PRODUCT ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

/* =========================================================
   GET ALL PRODUCTS
========================================================= */

router.get("/", async (req, res) => {
  try {
    await ensureCatalogColumns();

    const productsResult = await pool.query(`
      SELECT
        p.*,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c
        ON c.id = p.category_id
      ORDER BY p.id DESC
    `);

    const products = [];

    for (const product of productsResult.rows) {
      const typesResult = await pool.query(
        `
        SELECT *
        FROM product_types
        WHERE product_id = $1
        ORDER BY id ASC
        `,
        [product.id]
      );

      const types = [];

      for (const type of typesResult.rows) {
        const variantsResult = await pool.query(
          `
          SELECT *
          FROM product_variants
          WHERE product_type_id = $1
          ORDER BY id ASC
          `,
          [type.id]
        );

        types.push({
          id: type.id,
          name: type.name,
          origin: type.origin,
          brand: type.brand,
          description: type.description,
          image: type.image,
          status: type.status,
          variants: variantsResult.rows.map((variant) => ({
            id: variant.id,
            product_id: variant.product_id,
            product_type_id: variant.product_type_id,
            weight: variant.weight,
            price: Number(variant.price || 0),
            bulk_price:
              variant.bulk_price != null
                ? Number(variant.bulk_price)
                : null,
            stock: Number(variant.stock || 0),
            image_url: variant.image_url || "",
          })),
        });
      }

      /*
       * Legacy variants:
       *
       * These are existing variants that have product_id
       * but do not yet have product_type_id.
       *
       * We preserve them.
       */
      const legacyVariantsResult = await pool.query(
        `
        SELECT *
        FROM product_variants
        WHERE product_id = $1
        AND product_type_id IS NULL
        ORDER BY id ASC
        `,
        [product.id]
      );

      products.push({
        id: product.id,
        name: product.name,
        slug: product.slug || "",
        description: product.description || "",
        category: product.category_name || null,
        category_id: product.category_id || null,

        price: Number(product.price || 0),

        bulk_price:
          product.bulk_price != null
            ? Number(product.bulk_price)
            : null,

        stock_quantity: Number(product.stock_quantity || 0),

        weight: product.weight || "",

        image_url:
          product.image_url ||
          product.image ||
          "",

        image:
          product.image ||
          product.image_url ||
          "",

        types,

        variants: legacyVariantsResult.rows.map((variant) => ({
          id: variant.id,
          product_id: variant.product_id,
          product_type_id: variant.product_type_id,
          weight: variant.weight,
          price: Number(variant.price || 0),
          bulk_price:
            variant.bulk_price != null
              ? Number(variant.bulk_price)
              : null,
          stock: Number(variant.stock || 0),
          image_url: variant.image_url || "",
        })),
      });
    }

    res.json(products);
  } catch (err) {
    console.error("FETCH PRODUCTS ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

/* =========================================================
   GET SINGLE PRODUCT
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    await ensureCatalogColumns();

    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        error: "Valid product id is required",
      });
    }

    const productResult = await pool.query(
      `
      SELECT
        p.*,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c
        ON c.id = p.category_id
      WHERE p.id = $1
      `,
      [productId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    const product = productResult.rows[0];

    const typesResult = await pool.query(
      `
      SELECT *
      FROM product_types
      WHERE product_id = $1
      ORDER BY id ASC
      `,
      [productId]
    );

    const types = [];

    for (const type of typesResult.rows) {
      const variants = await pool.query(
        `
        SELECT *
        FROM product_variants
        WHERE product_type_id = $1
        ORDER BY id ASC
        `,
        [type.id]
      );

      types.push({
        ...type,
        variants: variants.rows,
      });
    }

    const legacyVariants = await pool.query(
      `
      SELECT *
      FROM product_variants
      WHERE product_id = $1
      AND product_type_id IS NULL
      ORDER BY id ASC
      `,
      [productId]
    );

    res.json({
      ...product,
      category: product.category_name || null,
      types,
      variants: legacyVariants.rows,
    });
  } catch (err) {
    console.error("FETCH SINGLE PRODUCT ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

/* =========================================================
   UPDATE PRODUCT
========================================================= */

router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensureCatalogColumns();

    const productId = Number(req.params.id);

    const existing = await pool.query(
      "SELECT * FROM products WHERE id = $1",
      [productId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    const current = existing.rows[0];

    let {
      name,
      category_id,
      description,
      price,
      bulk_price,
      stock_quantity,
      weight,
      image_url,
      image,
      slug,
    } = req.body;

    price = parseNumber(price);

    bulk_price =
      bulk_price === "" || bulk_price == null
        ? null
        : parseNumber(bulk_price);

    stock_quantity = parseNumber(stock_quantity);

    const updated = await pool.query(
      `
      UPDATE products
      SET
        name = $1,
        category_id = $2,
        description = $3,
        price = $4,
        bulk_price = $5,
        stock_quantity = $6,
        weight = $7,
        image_url = $8,
        image = $9,
        slug = $10
      WHERE id = $11
      RETURNING *
      `,
      [
        name?.trim() || current.name,
        category_id || null,
        description || "",
        price,
        bulk_price,
        stock_quantity,
        weight || "",
        image_url || image || "",
        image || image_url || "",
        slugify(slug || name || current.name),
        productId,
      ]
    );

    const change =
      stock_quantity - Number(current.stock_quantity || 0);

    if (change !== 0) {
      const historyExists = await tableExists("public.stock_history");

      if (historyExists) {
        await pool.query(
          `
          INSERT INTO stock_history
            (
              product_id,
              admin_id,
              change,
              previous_stock,
              new_stock
            )
          VALUES
            ($1,$2,$3,$4,$5)
          `,
          [
            productId,
            req.user.id,
            change,
            current.stock_quantity,
            stock_quantity,
          ]
        );
      }
    }

    res.json(updated.rows[0]);
  } catch (err) {
    console.error("UPDATE PRODUCT ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

/* =========================================================
   DELETE PRODUCT
========================================================= */

router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const productId = Number(req.params.id);

    await client.query("BEGIN");

    await client.query(
      `
      DELETE FROM product_variants
      WHERE product_id = $1
      `,
      [productId]
    );

    await client.query(
      `
      DELETE FROM product_types
      WHERE product_id = $1
      `,
      [productId]
    );

    if (await tableExists("public.stock_history")) {
      await client.query(
        `
        DELETE FROM stock_history
        WHERE product_id = $1
        `,
        [productId]
      );
    }

    await client.query(
      `
      DELETE FROM products
      WHERE id = $1
      `,
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
      error: err.message,
    });
  } finally {
    client.release();
  }
});

/* =========================================================
   PRODUCT TYPES / VARIETIES
========================================================= */

/* GET TYPES FOR PRODUCT */
router.get("/:id/types", async (req, res) => {
  try {
    const productId = Number(req.params.id);

    const result = await pool.query(
      `
      SELECT *
      FROM product_types
      WHERE product_id = $1
      ORDER BY id ASC
      `,
      [productId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET PRODUCT TYPES ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

/* CREATE PRODUCT TYPE */
router.post("/:id/types", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensureCatalogColumns();

    const productId = Number(req.params.id);

    const {
      name,
      origin,
      brand,
      description,
      image,
      status = true,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        error: "Product type name is required",
      });
    }

    const product = await pool.query(
      `
      SELECT id
      FROM products
      WHERE id = $1
      `,
      [productId]
    );

    if (product.rows.length === 0) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO product_types
        (
          product_id,
          name,
          origin,
          brand,
          description,
          image,
          status
        )
      VALUES
        ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        productId,
        name.trim(),
        origin || "",
        brand || "",
        description || "",
        image || "",
        Boolean(status),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("CREATE PRODUCT TYPE ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

/* UPDATE PRODUCT TYPE */
router.put(
  "/types/:typeId",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      await ensureCatalogColumns();

      const { typeId } = req.params;

      const {
        name,
        origin,
        brand,
        description,
        image,
        status,
      } = req.body;

      if (!name?.trim()) {
        return res.status(400).json({
          error: "Product type name is required",
        });
      }

      const result = await pool.query(
        `
        UPDATE product_types
        SET
          name = $1,
          origin = $2,
          brand = $3,
          description = $4,
          image = $5,
          status = $6
        WHERE id = $7
        RETURNING *
        `,
        [
          name.trim(),
          origin || "",
          brand || "",
          description || "",
          image || "",
          status !== undefined ? Boolean(status) : true,
          typeId,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Product type not found",
        });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("UPDATE PRODUCT TYPE ERROR:", err);

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

/* DELETE PRODUCT TYPE */
router.delete(
  "/types/:typeId",
  verifyToken,
  isAdmin,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { typeId } = req.params;

      await client.query("BEGIN");

      /*
       * Do not delete the variants themselves from inventory.
       * First detach them from the type.
       */
      await client.query(
        `
        UPDATE product_variants
        SET product_type_id = NULL
        WHERE product_type_id = $1
        `,
        [typeId]
      );

      const result = await client.query(
        `
        DELETE FROM product_types
        WHERE id = $1
        RETURNING *
        `,
        [typeId]
      );

      await client.query("COMMIT");

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Product type not found",
        });
      }

      res.json({
        success: true,
        message: "Product type deleted successfully",
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error("DELETE PRODUCT TYPE ERROR:", err);

      res.status(500).json({
        error: err.message,
      });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   VARIANTS
========================================================= */

/* GET ALL VARIANTS FOR PRODUCT */
router.get("/:id/variants", verifyToken, isAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);

    const result = await pool.query(
      `
      SELECT
        v.*,
        pt.name AS product_type_name
      FROM product_variants v
      LEFT JOIN product_types pt
        ON pt.id = v.product_type_id
      WHERE v.product_id = $1
      ORDER BY v.id DESC
      `,
      [productId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET VARIANTS ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

/* PUBLIC VARIANTS */
router.get("/:id/variants/public", async (req, res) => {
  try {
    const productId = Number(req.params.id);

    const result = await pool.query(
      `
      SELECT
        v.*,
        pt.name AS product_type_name
      FROM product_variants v
      LEFT JOIN product_types pt
        ON pt.id = v.product_type_id
      WHERE v.product_id = $1
      ORDER BY
        v.product_type_id NULLS FIRST,
        v.id ASC
      `,
      [productId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET PUBLIC VARIANTS ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

/* ADD VARIANT TO PRODUCT */
router.post("/:id/variants", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensureCatalogColumns();

    const productId = Number(req.params.id);

    const {
      product_type_id,
      weight,
      price,
      bulk_price,
      stock,
      image_url,
    } = req.body;

    if (!weight?.trim()) {
      return res.status(400).json({
        error: "Weight is required",
      });
    }

    const product = await pool.query(
      `
      SELECT id
      FROM products
      WHERE id = $1
      `,
      [productId]
    );

    if (product.rows.length === 0) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    if (product_type_id) {
      const type = await pool.query(
        `
        SELECT id
        FROM product_types
        WHERE id = $1
        AND product_id = $2
        `,
        [product_type_id, productId]
      );

      if (type.rows.length === 0) {
        return res.status(400).json({
          error: "Product type does not belong to this product",
        });
      }
    }

    const result = await pool.query(
      `
      INSERT INTO product_variants
        (
          product_id,
          product_type_id,
          weight,
          price,
          bulk_price,
          stock,
          image_url
        )
      VALUES
        ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        productId,
        product_type_id || null,
        weight.trim(),
        parseNumber(price),
        bulk_price === "" || bulk_price == null
          ? null
          : parseNumber(bulk_price),
        parseNumber(stock),
        image_url || "",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("ADD VARIANT ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

/* UPDATE VARIANT */
router.put(
  "/variants/:variant_id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      await ensureCatalogColumns();

      const { variant_id } = req.params;

      const {
        product_type_id,
        weight,
        price,
        bulk_price,
        stock,
        image_url,
      } = req.body;

      const result = await pool.query(
        `
        UPDATE product_variants
        SET
          product_type_id = $1,
          weight = $2,
          price = $3,
          bulk_price = $4,
          stock = $5,
          image_url = $6
        WHERE id = $7
        RETURNING *
        `,
        [
          product_type_id || null,
          weight || "",
          parseNumber(price),
          bulk_price === "" || bulk_price == null
            ? null
            : parseNumber(bulk_price),
          parseNumber(stock),
          image_url || "",
          variant_id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Variant not found",
        });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("UPDATE VARIANT ERROR:", err);

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

/* DELETE VARIANT */
router.delete(
  "/:productId/variants/:variantId",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const {
        productId,
        variantId,
      } = req.params;

      const result = await pool.query(
        `
        DELETE FROM product_variants
        WHERE id = $1
        AND product_id = $2
        RETURNING *
        `,
        [variantId, productId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Variant not found",
        });
      }

      res.json({
        success: true,
        message: "Variant deleted successfully",
      });
    } catch (err) {
      console.error("DELETE VARIANT ERROR:", err);

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

/* =========================================================
   STOCK HISTORY
========================================================= */

router.get(
  "/history/:product_id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const productId = Number(req.params.product_id);

      const result = await pool.query(
        `
        SELECT
          stock_history.*,
          users.name
        FROM stock_history
        JOIN users
          ON stock_history.admin_id = users.id
        WHERE stock_history.product_id = $1
        ORDER BY created_at DESC
        `,
        [productId]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("HISTORY ERROR:", err);

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

module.exports = router;