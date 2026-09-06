const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const {
  verifyToken,
  isAdmin,
} = require("../middleware/auth");

const isStaleUploadFilenameReference = (value) => {
  const normalized = String(value || "")
    .replace(/\\/g, "/")
    .split("?")[0]
    .split("#")[0]
    .trim();

  if (!normalized) return false;

  const candidate = normalized
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "");

  if (!candidate) return false;

  return (
    /(?:^|\/)[a-z0-9._-]+-\d{10,}\.(?:jpe?g|png|webp|jfif)$/i.test(candidate) ||
    /(?:^|\/)[a-z0-9._-]+-\d{10,}\.(?:jpe?g|png|webp|jfif)\.(?:jpe?g|png|webp|jfif)$/i.test(candidate) ||
    /(?:^|\/)[a-z0-9._-]+\.(?:jpe?g|png|webp|jfif)\.(?:jpe?g|png|webp|jfif)$/i.test(candidate)
  );
};

const normalizeStoredCategoryImage = (value) => {
  if (value === null || value === undefined) return "";

  const normalized = String(value).trim();
  if (!normalized) return "";

  const sanitized = normalized
    .replace(/\\/g, "/")
    .split("?")[0]
    .split("#")[0]
    .trim();

  if (!sanitized || sanitized === "/") return "";

  const canonicalPath = sanitized.replace(/^https?:\/\/[^/]+/i, "");

  if (isStaleUploadFilenameReference(canonicalPath)) return "";

  if (/(?:\.(?:jpe?g|png|webp|jfif))+$/i.test(canonicalPath)) {
    const singleExt = canonicalPath.replace(
      /(?:\.(?:jpe?g|png|webp|jfif))+$/i,
      ""
    );

    if (/(?:\.(?:jpe?g|png|webp|jfif))\.(?:jpe?g|png|webp|jfif)$/i.test(canonicalPath)) {
      return "";
    }

    if (singleExt && /-\d{10,}$/.test(singleExt)) {
      return "";
    }
  }

  if (canonicalPath.startsWith("/grains/uploads/") || canonicalPath.startsWith("grains/uploads/")) {
    return `/${canonicalPath.replace(/^\/?grains\//i, "")}`;
  }

  return sanitized;
};

/* =========================
   GET ALL CATEGORIES
   PUBLIC
========================= */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
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

    const categories = result.rows.map((category) => ({
      ...category,
      image: normalizeStoredCategoryImage(category.image),
    }));

    res.json(categories);
  } catch (err) {
    console.error("GET CATEGORIES ERROR:", err);

    res.status(500).json({
      error: "Failed to load categories",
    });
  }
});

/* =========================
   GET SINGLE CATEGORY
========================= */
router.get("/:id", async (req, res) => {
  try {
    const categoryId = Number(req.params.id);

    if (!Number.isInteger(categoryId)) {
      return res.status(400).json({
        error: "Invalid category ID",
      });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM categories
      WHERE id = $1
      `,
      [categoryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Category not found",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET CATEGORY ERROR:", err);

    res.status(500).json({
      error: "Failed to load category",
    });
  }
});

/* =========================
   CREATE CATEGORY
   ADMIN ONLY
========================= */
router.post(
  "/",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const {
        name,
        slug,
        description,
        image,
        status,
      } = req.body;

      if (!name || !String(name).trim()) {
        return res.status(400).json({
          error: "Category name is required",
        });
      }

      const categoryName = String(name).trim();

      const categorySlug =
        String(
          slug ||
            categoryName
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "")
        );

      /* Check duplicate name */

      const existingName = await pool.query(
        `
        SELECT id
        FROM categories
        WHERE LOWER(name) = LOWER($1)
        `,
        [categoryName]
      );

      if (existingName.rows.length > 0) {
        return res.status(409).json({
          error: "Category already exists",
        });
      }

      /* Check duplicate slug */

      const existingSlug = await pool.query(
        `
        SELECT id
        FROM categories
        WHERE slug = $1
        `,
        [categorySlug]
      );

      if (existingSlug.rows.length > 0) {
        return res.status(409).json({
          error: "Category slug already exists",
        });
      }

      const safeImage = normalizeStoredCategoryImage(image);

      const result = await pool.query(
        `
        INSERT INTO categories
        (
          name,
          slug,
          description,
          image,
          status
        )
        VALUES
        ($1,$2,$3,$4,$5)
        RETURNING *
        `,
        [
          categoryName,
          categorySlug,
          description || "",
          safeImage,
          status !== undefined
            ? Boolean(status)
            : true,
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(
        "CREATE CATEGORY ERROR:",
        err
      );

      res.status(500).json({
        error:
          err.message ||
          "Failed to create category",
      });
    }
  }
);

/* =========================
   UPDATE CATEGORY
   ADMIN ONLY
========================= */
router.put(
  "/:id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const categoryId = Number(req.params.id);

      if (!Number.isInteger(categoryId)) {
        return res.status(400).json({
          error: "Invalid category ID",
        });
      }

      const {
        name,
        slug,
        description,
        image,
        status,
      } = req.body;

      if (!name || !String(name).trim()) {
        return res.status(400).json({
          error: "Category name is required",
        });
      }

      const existing = await pool.query(
        `
        SELECT *
        FROM categories
        WHERE id = $1
        `,
        [categoryId]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({
          error: "Category not found",
        });
      }

      const categoryName = String(name).trim();

      const categorySlug =
        String(
          slug ||
            categoryName
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "")
        );

      const duplicate = await pool.query(
        `
        SELECT id
        FROM categories
        WHERE
          (LOWER(name) = LOWER($1)
           OR slug = $2)
          AND id <> $3
        `,
        [
          categoryName,
          categorySlug,
          categoryId,
        ]
      );

      if (duplicate.rows.length > 0) {
        return res.status(409).json({
          error:
            "Another category already uses this name or slug",
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
          categoryName,
          categorySlug,
          description || "",
          image || "",
          status !== undefined
            ? Boolean(status)
            : existing.rows[0].status,
          categoryId,
        ]
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error(
        "UPDATE CATEGORY ERROR:",
        err
      );

      res.status(500).json({
        error:
          err.message ||
          "Failed to update category",
      });
    }
  }
);

/* =========================
   DEACTIVATE CATEGORY
   ADMIN ONLY

   We DO NOT delete the category.
   This protects existing products.
========================= */
router.patch(
  "/:id/status",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const categoryId = Number(req.params.id);

      const { status } = req.body;

      if (!Number.isInteger(categoryId)) {
        return res.status(400).json({
          error: "Invalid category ID",
        });
      }

      const result = await pool.query(
        `
        UPDATE categories
        SET status = $1
        WHERE id = $2
        RETURNING *
        `,
        [
          Boolean(status),
          categoryId,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Category not found",
        });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error(
        "CATEGORY STATUS ERROR:",
        err
      );

      res.status(500).json({
        error: "Failed to update category status",
      });
    }
  }
);

/* =========================
   DELETE CATEGORY
   ADMIN ONLY

   ONLY allowed when no product
   is using the category.
========================= */
router.delete(
  "/:id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const categoryId = Number(req.params.id);

      if (!Number.isInteger(categoryId)) {
        return res.status(400).json({
          error: "Invalid category ID",
        });
      }

      const products = await pool.query(
        `
        SELECT COUNT(*)::int AS count
        FROM products
        WHERE category_id = $1
        `,
        [categoryId]
      );

      const productCount =
        products.rows[0].count;

      if (productCount > 0) {
        return res.status(409).json({
          error:
            "Category cannot be deleted because products are using it. Deactivate it instead.",
          product_count: productCount,
        });
      }

      const result = await pool.query(
        `
        DELETE FROM categories
        WHERE id = $1
        RETURNING *
        `,
        [categoryId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Category not found",
        });
      }

      res.json({
        success: true,
        message: "Category deleted successfully",
        category: result.rows[0],
      });
    } catch (err) {
      console.error(
        "DELETE CATEGORY ERROR:",
        err
      );

      res.status(500).json({
        error:
          err.message ||
          "Failed to delete category",
      });
    }
  }
);

module.exports = router;