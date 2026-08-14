const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Get all product types
router.get("/", async (req, res) => {
  try {
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
        COUNT(pv.id) AS variant_count
      FROM product_types pt
      LEFT JOIN products p ON p.id = pt.product_id
      LEFT JOIN product_variants pv ON pv.product_type_id = pt.id
      GROUP BY pt.id, p.id
      ORDER BY p.name ASC, pt.name ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
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