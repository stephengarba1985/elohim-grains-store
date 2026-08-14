const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Get all categories
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM categories
      WHERE status = TRUE
      ORDER BY name ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load categories" });
  }
});

// Create category
router.post("/", async (req, res) => {
  try {
    const { name, description, image } = req.body;

    const result = await pool.query(
      `
      INSERT INTO categories
      (name, description, image)
      VALUES ($1,$2,$3)
      RETURNING *
      `,
      [name, description, image]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to create category",
    });
  }
});

// Update category
router.put("/:id", async (req, res) => {
  try {
    const { name, description, image, status } = req.body;

    const result = await pool.query(
      `
      UPDATE categories
      SET
        name=$1,
        description=$2,
        image=$3,
        status=$4
      WHERE id=$5
      RETURNING *
      `,
      [name, description, image, status, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to update category",
    });
  }
});

// Delete category
router.delete("/:id", async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM categories WHERE id=$1",
      [req.params.id]
    );

    res.json({
      message: "Category deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to delete category",
    });
  }
});

module.exports = router;