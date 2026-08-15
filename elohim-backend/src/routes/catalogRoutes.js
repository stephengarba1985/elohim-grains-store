const express = require("express");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

const slugify = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const parseNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

/* =========================================================
   GET COMPLETE CATALOG
   CATEGORY → PRODUCT → TYPE → VARIANT
========================================================= */

router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const categories = await pool.query(`
      SELECT
        id,
        name,
        slug,
        description,
        image,
        status,
        created_at
      FROM categories
      ORDER BY name ASC
    `);

    const products = await pool.query(`
      SELECT
        p.id,
        p.name,
        p.slug,
        p.description,
        p.image_url,
        p.image,
        p.category_id,
        p.price,
        p.bulk_price,
        p.stock_quantity,
        p.weight,
        p.created_at
      FROM products p
      ORDER BY p.name ASC
    `);

    const types = await pool.query(`
      SELECT
        pt.id,
        pt.product_id,
        pt.name,
        pt.origin,
        pt.brand,
        pt.description,
        pt.image,
        pt.status,
        pt.created_at
      FROM product_types pt
      ORDER BY pt.name ASC
    `);

    const variants = await pool.query(`
      SELECT
        pv.id,
        pv.product_id,
        pv.product_type_id,
        pv.weight,
        pv.price,
        pv.stock,
        pv.created_at
      FROM product_variants pv
      ORDER BY pv.weight ASC
    `);

    res.json({
      categories: categories.rows,
      products: products.rows,
      product_types: types.rows,
      variants: variants.rows,
    });
  } catch (err) {
    console.error("CATALOG FETCH ERROR:", err);

    res.status(500).json({
      error: "Failed to load catalog",
    });
  }
});

/* =========================================================
   CATEGORY
========================================================= */

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

      const finalSlug = slugify(slug || name);

      const existing = await pool.query(
        `
        SELECT id
        FROM categories
        WHERE LOWER(name) = LOWER($1)
           OR LOWER(slug) = LOWER($2)
        LIMIT 1
        `,
        [name.trim(), finalSlug]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: "Category already exists",
        });
      }

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
          finalSlug,
          description || "",
          image || "",
          Boolean(status),
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("CREATE CATEGORY ERROR:", err);

      res.status(500).json({
        error: "Failed to create category",
        detail: err.message,
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
      const id = Number(req.params.id);

      const {
        name,
        slug,
        description,
        image,
        status,
      } = req.body;

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          error: "Invalid category ID",
        });
      }

      if (!name?.trim()) {
        return res.status(400).json({
          error: "Category name is required",
        });
      }

      const finalSlug = slugify(slug || name);

      const result = await pool.query(
        `
        UPDATE categories
        SET
          name=$1,
          slug=$2,
          description=$3,
          image=$4,
          status=$5
        WHERE id=$6
        RETURNING *
        `,
        [
          name.trim(),
          finalSlug,
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
        error: "Failed to update category",
        detail: err.message,
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
    const client = await pool.connect();

    try {
      const id = Number(req.params.id);

      await client.query("BEGIN");

      const products = await client.query(
        `
        SELECT id
        FROM products
        WHERE category_id=$1
        `,
        [id]
      );

      if (products.rows.length > 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            "Cannot delete category while products are assigned to it. Move or delete the products first.",
        });
      }

      const result = await client.query(
        `
        DELETE FROM categories
        WHERE id=$1
        RETURNING *
        `,
        [id]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Category not found",
        });
      }

      await client.query("COMMIT");

      res.json({
        success: true,
        message: "Category deleted successfully",
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error("DELETE CATEGORY ERROR:", err);

      res.status(500).json({
        error: "Failed to delete category",
      });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   PRODUCT
========================================================= */

/* CREATE PRODUCT */

router.post(
  "/products",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const {
        name,
        category_id,
        description,
        image,
        image_url,
        price = 0,
        bulk_price = 0,
        stock_quantity = 0,
        weight = "",
      } = req.body;

      if (!name?.trim()) {
        return res.status(400).json({
          error: "Product name is required",
        });
      }

      if (!category_id) {
        return res.status(400).json({
          error: "Category is required",
        });
      }

      const category = await pool.query(
        "SELECT id FROM categories WHERE id=$1",
        [category_id]
      );

      if (category.rows.length === 0) {
        return res.status(404).json({
          error: "Category not found",
        });
      }

      const finalSlug = slugify(name);

      const duplicate = await pool.query(
        `
        SELECT id
        FROM products
        WHERE LOWER(name)=LOWER($1)
        LIMIT 1
        `,
        [name.trim()]
      );

      if (duplicate.rows.length > 0) {
        return res.status(409).json({
          error: "Product already exists",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO products
        (
          name,
          stock_quantity,
          weight,
          image_url,
          slug,
          description,
          image,
          category_id,
          price,
          bulk_price
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *
        `,
        [
          name.trim(),
          parseNumber(stock_quantity),
          weight || "",
          image_url || image || "",
          finalSlug,
          description || "",
          image || image_url || "",
          Number(category_id),
          parseNumber(price),
          parseNumber(bulk_price),
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("CREATE PRODUCT ERROR:", err);

      res.status(500).json({
        error: "Failed to create product",
        detail: err.message,
      });
    }
  }
);

/* UPDATE PRODUCT */

router.put(
  "/products/:id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const {
        name,
        category_id,
        description,
        image,
        image_url,
        price,
        bulk_price,
        stock_quantity,
        weight,
      } = req.body;

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          error: "Invalid product ID",
        });
      }

      const result = await pool.query(
        `
        UPDATE products
        SET
          name=$1,
          category_id=$2,
          description=$3,
          image=$4,
          image_url=$5,
          price=$6,
          bulk_price=$7,
          stock_quantity=$8,
          weight=$9
        WHERE id=$10
        RETURNING *
        `,
        [
          name?.trim(),
          category_id || null,
          description || "",
          image || image_url || "",
          image_url || image || "",
          parseNumber(price),
          parseNumber(bulk_price),
          parseNumber(stock_quantity),
          weight || "",
          id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Product not found",
        });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("UPDATE PRODUCT ERROR:", err);

      res.status(500).json({
        error: "Failed to update product",
        detail: err.message,
      });
    }
  }
);

/* DELETE PRODUCT */

router.delete(
  "/products/:id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = Number(req.params.id);

      await client.query("BEGIN");

      await client.query(
        "DELETE FROM product_variants WHERE product_id=$1",
        [id]
      );

      await client.query(
        "DELETE FROM product_types WHERE product_id=$1",
        [id]
      );

      const result = await client.query(
        `
        DELETE FROM products
        WHERE id=$1
        RETURNING *
        `,
        [id]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Product not found",
        });
      }

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
  }
);

/* =========================================================
   PRODUCT TYPE / VARIETY
========================================================= */

/* CREATE PRODUCT TYPE */

router.post(
  "/product-types",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const {
        product_id,
        name,
        origin,
        brand,
        description,
        image,
        status = true,
      } = req.body;

      if (!product_id || !name?.trim()) {
        return res.status(400).json({
          error: "Product and product type name are required",
        });
      }

      const product = await pool.query(
        "SELECT id FROM products WHERE id=$1",
        [product_id]
      );

      if (product.rows.length === 0) {
        return res.status(404).json({
          error: "Product not found",
        });
      }

      const duplicate = await pool.query(
        `
        SELECT id
        FROM product_types
        WHERE product_id=$1
          AND LOWER(name)=LOWER($2)
        `,
        [product_id, name.trim()]
      );

      if (duplicate.rows.length > 0) {
        return res.status(409).json({
          error: "This product type already exists",
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
          product_id,
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
        error: "Failed to create product type",
        detail: err.message,
      });
    }
  }
);

/* UPDATE PRODUCT TYPE */

router.put(
  "/product-types/:id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const {
        product_id,
        name,
        origin,
        brand,
        description,
        image,
        status,
      } = req.body;

      const result = await pool.query(
        `
        UPDATE product_types
        SET
          product_id=$1,
          name=$2,
          origin=$3,
          brand=$4,
          description=$5,
          image=$6,
          status=$7
        WHERE id=$8
        RETURNING *
        `,
        [
          product_id,
          name?.trim(),
          origin || "",
          brand || "",
          description || "",
          image || "",
          status !== undefined ? Boolean(status) : true,
          id,
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
        error: "Failed to update product type",
        detail: err.message,
      });
    }
  }
);

/* DELETE PRODUCT TYPE */

router.delete(
  "/product-types/:id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = Number(req.params.id);

      await client.query("BEGIN");

      await client.query(
        "DELETE FROM product_variants WHERE product_type_id=$1",
        [id]
      );

      const result = await client.query(
        `
        DELETE FROM product_types
        WHERE id=$1
        RETURNING *
        `,
        [id]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Product type not found",
        });
      }

      await client.query("COMMIT");

      res.json({
        success: true,
        message: "Product type deleted successfully",
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error("DELETE PRODUCT TYPE ERROR:", err);

      res.status(500).json({
        error: "Failed to delete product type",
      });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   VARIANTS
========================================================= */

/* CREATE VARIANT */

router.post(
  "/variants",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const {
        product_id,
        product_type_id,
        weight,
        price,
        stock = 0,
      } = req.body;

      if (!product_id || !product_type_id || !weight) {
        return res.status(400).json({
          error: "Product, product type and weight are required",
        });
      }

      const productType = await pool.query(
        `
        SELECT id
        FROM product_types
        WHERE id=$1
          AND product_id=$2
        `,
        [product_type_id, product_id]
      );

      if (productType.rows.length === 0) {
        return res.status(400).json({
          error: "Product type does not belong to selected product",
        });
      }

      const duplicate = await pool.query(
        `
        SELECT id
        FROM product_variants
        WHERE product_type_id=$1
          AND LOWER(TRIM(weight))=LOWER(TRIM($2))
        `,
        [product_type_id, weight]
      );

      if (duplicate.rows.length > 0) {
        return res.status(409).json({
          error: "This weight already exists for this product type",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO product_variants
        (
          product_id,
          product_type_id,
          weight,
          price,
          stock
        )
        VALUES
        ($1,$2,$3,$4,$5)
        RETURNING *
        `,
        [
          product_id,
          product_type_id,
          weight.trim(),
          parseNumber(price),
          Math.max(0, Math.floor(parseNumber(stock))),
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("CREATE VARIANT ERROR:", err);

      res.status(500).json({
        error: "Failed to create variant",
        detail: err.message,
      });
    }
  }
);

/* UPDATE VARIANT */

router.put(
  "/variants/:id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const {
        product_id,
        product_type_id,
        weight,
        price,
        stock,
      } = req.body;

      const result = await pool.query(
        `
        UPDATE product_variants
        SET
          product_id=$1,
          product_type_id=$2,
          weight=$3,
          price=$4,
          stock=$5
        WHERE id=$6
        RETURNING *
        `,
        [
          product_id,
          product_type_id,
          weight?.trim(),
          parseNumber(price),
          Math.max(0, Math.floor(parseNumber(stock))),
          id,
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
        error: "Failed to update variant",
        detail: err.message,
      });
    }
  }
);

/* DELETE VARIANT */

router.delete(
  "/variants/:id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const result = await pool.query(
        `
        DELETE FROM product_variants
        WHERE id=$1
        RETURNING *
        `,
        [id]
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
        error: "Failed to delete variant",
      });
    }
  }
);

module.exports = router;