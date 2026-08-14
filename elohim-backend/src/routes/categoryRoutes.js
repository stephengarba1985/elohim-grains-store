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

// Get all categories
router.get("/", async (req, res) => {
  try {
    const categoriesTableExists = await tableExists("public.categories");
    if (!categoriesTableExists) {
      return res.json([]);
    }

    const hasStatusColumn = await columnExists("categories", "status");
    const whereClause = hasStatusColumn ? "WHERE status = TRUE" : "";

    const result = await pool.query(`
      SELECT *
      FROM categories
      ${whereClause}
      ORDER BY name ASC
    `);

    return res.json(result.rows);
  } catch (err) {
    console.error("LOAD CATEGORIES ERROR:", err);
    return res.status(500).json({ error: "Failed to load categories" });
  }
});

// Create category
router.post("/", async (req, res) => {
  try {
    const { name, description, image, status } = req.body;
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!trimmedName) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const hasStatusColumn = await columnExists("categories", "status");
    const normalizedStatus =
      status === undefined
        ? true
        : status === "false"
          ? false
          : status === "true"
            ? true
            : Boolean(status);

    const insertQuery = hasStatusColumn
      ? `
        INSERT INTO categories
        (name, description, image, status)
        VALUES ($1,$2,$3,$4)
        RETURNING *
      `
      : `
        INSERT INTO categories
        (name, description, image)
        VALUES ($1,$2,$3)
        RETURNING *
      `;

    const insertValues = hasStatusColumn
      ? [trimmedName, description ?? "", image ?? "", normalizedStatus]
      : [trimmedName, description ?? "", image ?? ""];

    const result = await pool.query(insertQuery, insertValues);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("CREATE CATEGORY ERROR:", err);

    if (err.code === "23505" || /duplicate key|unique/i.test(err.message)) {
      return res.status(409).json({ error: "Category name already exists" });
    }

    res.status(500).json({
      error: "Failed to create category",
    });
  }
});

// Update category
router.put("/:id", async (req, res) => {
  try {
    const { name, description, image, status } = req.body;
    const hasStatusColumn = await columnExists("categories", "status");
    const normalizedStatus =
      status === undefined
        ? true
        : status === "false"
          ? false
          : status === "true"
            ? true
            : Boolean(status);

    const updateQuery = hasStatusColumn
      ? `
        UPDATE categories
        SET
          name=$1,
          description=$2,
          image=$3,
          status=$4
        WHERE id=$5
        RETURNING *
      `
      : `
        UPDATE categories
        SET
          name=$1,
          description=$2,
          image=$3
        WHERE id=$4
        RETURNING *
      `;

    const updateValues = hasStatusColumn
      ? [name ?? "", description ?? "", image ?? "", normalizedStatus, req.params.id]
      : [name ?? "", description ?? "", image ?? "", req.params.id];

    const result = await pool.query(updateQuery, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("UPDATE CATEGORY ERROR:", err);
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