const express = require("express");
const router = express.Router();
const pool = require("../config/db");

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

// Get all product types
router.get("/", async (req, res) => {
  try {
    const productTypesTableExists = await tableExists("public.product_types");
    if (!productTypesTableExists) {
      return res.json([]);
    }

    const hasVariantsTable = await tableExists("public.product_variants");
    const hasProductTypeColumn = hasVariantsTable && await columnExists("product_variants", "product_type_id");

    let joinClause = "";
    let variantCountSelect = "0::bigint AS variant_count";

    if (hasVariantsTable && hasProductTypeColumn) {
      joinClause = "LEFT JOIN product_variants pv ON pv.product_type_id = pt.id";
      variantCountSelect = "COUNT(pv.id) AS variant_count";
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
      LEFT JOIN products p ON p.id = pt.product_id
      ${joinClause}
      GROUP BY pt.id, p.id
      ORDER BY p.name ASC, pt.name ASC
    `);

    return res.json(result.rows);
  } catch (err) {
    console.error("LOAD PRODUCT TYPES ERROR:", err);
    return res.status(500).json({
      error: "Failed to load product types",
    });
  }
});

// Get product types by product
router.get("/product/:productId", async (req, res) => {
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
});

// Create product type
router.post("/", async (req, res) => {
  try {
    const {
      product_id,
      name,
      origin,
      brand,
      description,
      image,
    } = req.body;

    const result = await pool.query(
      `
      INSERT INTO product_types
      (
        product_id,
        name,
        origin,
        brand,
        description,
        image
      )
      VALUES
      ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [
        product_id,
        name,
        origin,
        brand,
        description,
        image,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to create product type",
    });
  }
});

module.exports = router;