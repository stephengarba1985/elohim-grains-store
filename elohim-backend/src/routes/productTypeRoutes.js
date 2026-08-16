const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const { verifyToken, isAdmin } = require("../middleware/auth");

/* =========================
   HELPERS
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

/* =========================
   GET ALL PRODUCT TYPES
   PUBLIC
========================= */

router.get("/", async (req, res) => {
  try {
    const productTypesTableExists =
      await tableExists("public.product_types");

    if (!productTypesTableExists) {
      return res.json([]);
    }

    const hasVariantsTable =
      await tableExists("public.product_variants");

    const hasProductTypeColumn =
      hasVariantsTable &&
      await columnExists(
        "product_variants",
        "product_type_id"
      );

    let joinClause = "";
    let variantCountSelect = "0::bigint AS variant_count";

    if (hasVariantsTable) {
      if (hasProductTypeColumn) {
        joinClause = `
          LEFT JOIN product_variants pv
            ON pv.product_type_id = pt.id
        `;
      } else {
        joinClause = `
          LEFT JOIN product_variants pv
            ON pv.product_id = pt.product_id
        `;
      }

      variantCountSelect =
        "COUNT(DISTINCT pv.id) AS variant_count";
    }

    const result = await pool.query(`
      SELECT
        pt.id,
        pt.product_id,
        pt.name,
        pt.origin,
        pt.brand,
        pt.description,
        pt.image,
        pt.status,
        pt.created_at,

        p.name AS product_name,

        ${variantCountSelect}

      FROM product_types pt

      LEFT JOIN products p
        ON p.id = pt.product_id

      ${joinClause}

      GROUP BY pt.id, p.id

      ORDER BY
        p.name ASC,
        pt.name ASC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("LOAD PRODUCT TYPES ERROR:", err);

    res.status(500).json({
      error: "Failed to load product types",
    });
  }
});

/* =========================
   GET PRODUCT TYPES BY PRODUCT
========================= */

router.get("/product/:productId", async (req, res) => {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId)) {
      return res.status(400).json({
        error: "Invalid product ID",
      });
    }

    const result = await pool.query(
      `
      SELECT
        pt.*,
        COUNT(pv.id)::int AS variant_count

      FROM product_types pt

      LEFT JOIN product_variants pv
        ON pv.product_type_id = pt.id

      WHERE pt.product_id = $1

      GROUP BY pt.id

      ORDER BY pt.name ASC
      `,
      [productId]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(
      "LOAD PRODUCT TYPES BY PRODUCT ERROR:",
      err
    );

    res.status(500).json({
      error: "Failed to load product types",
    });
  }
});

/* =========================
   GET SINGLE PRODUCT TYPE
========================= */

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const result = await pool.query(
      `
      SELECT
        pt.*,
        p.name AS product_name

      FROM product_types pt

      LEFT JOIN products p
        ON p.id = pt.product_id

      WHERE pt.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Product type not found",
      });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(
      "GET PRODUCT TYPE ERROR:",
      err
    );

    res.status(500).json({
      error: "Failed to load product type",
    });
  }
});

/* =========================
   CREATE PRODUCT TYPE
   ADMIN ONLY
========================= */

router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      product_id,
      name,
      origin,
      brand,
      description,
      image,
    } = req.body;

    const productId = Number(product_id);

    if (!Number.isInteger(productId)) {
      return res.status(400).json({
        error: "Valid product is required",
      });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        error: "Product type name is required",
      });
    }

    /* =========================
       VERIFY PRODUCT
    ========================= */

    const product = await pool.query(
      `
      SELECT id, name
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

    /* =========================
       PREVENT DUPLICATE TYPE
    ========================= */

    const duplicate = await pool.query(
      `
      SELECT id
      FROM product_types
      WHERE product_id = $1
        AND LOWER(TRIM(name)) = LOWER(TRIM($2))
      `,
      [productId, name]
    );

    if (duplicate.rows.length > 0) {
      return res.status(409).json({
        error: "This product type already exists",
      });
    }

    /* =========================
       CREATE
    ========================= */

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
      ($1,$2,$3,$4,$5,$6,true)

      RETURNING *
      `,
      [
        productId,
        String(name).trim(),
        origin || "",
        brand || "",
        description || "",
        image || "",
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error(
      "CREATE PRODUCT TYPE ERROR:",
      err
    );

    res.status(500).json({
      error:
        err.message ||
        "Failed to create product type",
    });
  }
});

/* =========================
   UPDATE PRODUCT TYPE
   ADMIN ONLY
========================= */

router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const {
      name,
      origin,
      brand,
      description,
      image,
      status,
    } = req.body;

    if (!name || !String(name).trim()) {
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
        String(name).trim(),
        origin || "",
        brand || "",
        description || "",
        image || "",
        status !== false,
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
    console.error(
      "UPDATE PRODUCT TYPE ERROR:",
      err
    );

    res.status(500).json({
      error: "Failed to update product type",
    });
  }
});

/* =========================
   DELETE PRODUCT TYPE
   ADMIN ONLY
========================= */

router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const id = Number(req.params.id);

    await client.query("BEGIN");

    /*
      IMPORTANT:
      Do NOT delete variants.

      Existing inventory must remain.

      We simply remove the relationship between
      the variant and the deleted product type.
    */

    await client.query(
      `
      UPDATE product_variants
      SET product_type_id = NULL
      WHERE product_type_id = $1
      `,
      [id]
    );

    const result = await client.query(
      `
      DELETE FROM product_types
      WHERE id = $1
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
      message: "Product type deleted successfully",
      product_type: result.rows[0],
    });

  } catch (err) {
    await client.query("ROLLBACK");

    console.error(
      "DELETE PRODUCT TYPE ERROR:",
      err
    );

    res.status(500).json({
      error: "Failed to delete product type",
    });

  } finally {
    client.release();
  }
});

module.exports = router;