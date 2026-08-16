const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const {
  verifyToken,
  isAdmin,
} = require("../middleware/auth");

/* =========================
   TABLE HELPERS
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
========================= */

router.get("/", async (req, res) => {
  try {
    const productTypesTableExists =
      await tableExists("public.product_types");

    if (!productTypesTableExists) {
      return res.json([]);
    }

    const variantsTableExists =
      await tableExists("public.product_variants");

    const hasProductTypeColumn =
      variantsTableExists &&
      await columnExists(
        "product_variants",
        "product_type_id"
      );

    let joinClause = "";
    let variantCountSelect =
      "0::bigint AS variant_count";

    if (variantsTableExists) {
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
    console.error(
      "LOAD PRODUCT TYPES ERROR:",
      err
    );

    res.status(500).json({
      error: "Failed to load product types",
    });
  }
});

/* =========================
   GET PRODUCT TYPES BY PRODUCT
========================= */

router.get(
  "/product/:productId",
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM product_types
        WHERE product_id = $1
        ORDER BY name ASC
        `,
        [req.params.productId]
      );

      res.json(result.rows);

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Failed to load product types",
      });
    }
  }
);

/* =========================
   CREATE PRODUCT TYPE
========================= */

router.post(
  "/",
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
      } = req.body;

      if (!product_id) {
        return res.status(400).json({
          error: "Product is required",
        });
      }

      if (!name || !String(name).trim()) {
        return res.status(400).json({
          error: "Product type name is required",
        });
      }

      const product = await pool.query(
        `
        SELECT id, name
        FROM products
        WHERE id = $1
        `,
        [product_id]
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
        ($1,$2,$3,$4,$5,$6,true)
        RETURNING *
        `,
        [
          Number(product_id),
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
        error: err.message ||
          "Failed to create product type",
      });
    }
  }
);

/* =========================
   UPDATE PRODUCT TYPE
========================= */

router.put(
  "/:id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const typeId = Number(req.params.id);

      const {
        product_id,
        name,
        origin,
        brand,
        description,
        image,
        status,
      } = req.body;

      if (!Number.isInteger(typeId)) {
        return res.status(400).json({
          error: "Invalid product type ID",
        });
      }

      if (!name || !String(name).trim()) {
        return res.status(400).json({
          error: "Product type name is required",
        });
      }

      const existing = await pool.query(
        `
        SELECT *
        FROM product_types
        WHERE id = $1
        `,
        [typeId]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({
          error: "Product type not found",
        });
      }

      const current = existing.rows[0];

      const newProductId =
        product_id || current.product_id;

      const result = await pool.query(
        `
        UPDATE product_types
        SET
          product_id = $1,
          name = $2,
          origin = $3,
          brand = $4,
          description = $5,
          image = $6,
          status = $7
        WHERE id = $8
        RETURNING *
        `,
        [
          Number(newProductId),
          String(name).trim(),
          origin || "",
          brand || "",
          description || "",
          image || "",
          status !== undefined
            ? Boolean(status)
            : current.status,
          typeId,
        ]
      );

      res.json(result.rows[0]);

    } catch (err) {
      console.error(
        "UPDATE PRODUCT TYPE ERROR:",
        err
      );

      res.status(500).json({
        error:
          err.message ||
          "Failed to update product type",
      });
    }
  }
);

/* =========================
   DELETE PRODUCT TYPE
========================= */

router.delete(
  "/:id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const typeId = Number(req.params.id);

      await client.query("BEGIN");

      const existing = await client.query(
        `
        SELECT *
        FROM product_types
        WHERE id = $1
        `,
        [typeId]
      );

      if (existing.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Product type not found",
        });
      }

      /*
       * IMPORTANT:
       * Do NOT delete variants.
       *
       * We simply remove their product_type_id.
       * The inventory remains intact.
       */

      const variants = await client.query(
        `
        UPDATE product_variants
        SET product_type_id = NULL
        WHERE product_type_id = $1
        RETURNING id
        `,
        [typeId]
      );

      await client.query(
        `
        DELETE FROM product_types
        WHERE id = $1
        `,
        [typeId]
      );

      await client.query("COMMIT");

      res.json({
        success: true,
        message: "Product type deleted",
        unassigned_variants:
          variants.rows.length,
      });

    } catch (err) {
      await client.query("ROLLBACK");

      console.error(
        "DELETE PRODUCT TYPE ERROR:",
        err
      );

      res.status(500).json({
        error:
          err.message ||
          "Failed to delete product type",
      });

    } finally {
      client.release();
    }
  }
);

module.exports = router;