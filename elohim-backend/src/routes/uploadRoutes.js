const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

/* =========================================================
   ENVIRONMENT
========================================================= */

const uploadsRootEnv = process.env.UPLOADS_ROOT;
const railwayVolumeRoot = process.env.RAILWAY_VOLUME_MOUNT_PATH;
const uploadProductsDirEnv = process.env.UPLOAD_PRODUCTS_DIR;
const uploadCatalogDirEnv = process.env.UPLOAD_CATALOG_DIR;

const isProduction = process.env.NODE_ENV === "production";

/* =========================================================
   PATH HELPERS
========================================================= */

/**
 * Convert a configured uploads root into the actual
 * products directory.
 *
 * Examples:
 *   /data/uploads       -> /data/uploads/products
 *   /data               -> /data/uploads/products
 *   /data/uploads/products -> /data/uploads/products
 */
const toProductsDir = (rootPath) => {
  if (!rootPath) return null;

  const resolved = path.resolve(rootPath);
  const base = path.basename(resolved).toLowerCase();

  if (base === "products") {
    return resolved;
  }

  if (base === "uploads") {
    return path.join(resolved, "products");
  }

  return path.join(resolved, "uploads", "products");
};

/**
 * Convert a configured uploads root into the actual
 * catalog directory.
 *
 * Examples:
 *   /data/uploads       -> /data/uploads/catalog
 *   /data               -> /data/uploads/catalog
 *   /data/uploads/catalog -> /data/uploads/catalog
 */
const toCatalogDir = (rootPath) => {
  if (!rootPath) return null;

  const resolved = path.resolve(rootPath);
  const base = path.basename(resolved).toLowerCase();

  if (base === "catalog") {
    return resolved;
  }

  if (base === "uploads") {
    return path.join(resolved, "catalog");
  }

  return path.join(resolved, "uploads", "catalog");
};

/**
 * Remove duplicate paths while preserving order.
 */
const uniquePaths = (paths) => {
  return Array.from(
    new Set(
      paths
        .filter(Boolean)
        .map((item) => path.resolve(item))
    )
  );
};

/**
 * Find the first writable directory.
 */
const findWritableDirectory = (candidates) => {
  for (const candidate of uniquePaths(candidates)) {
    try {
      fs.mkdirSync(candidate, { recursive: true });
      fs.accessSync(candidate, fs.constants.W_OK);
      return candidate;
    } catch (err) {
      console.warn(
        `[UPLOAD] Directory unavailable: ${candidate}`,
        err.message
      );
    }
  }

  return null;
};

/* =========================================================
   PRODUCT UPLOAD DIRECTORY
========================================================= */

const productUploadCandidates = [
  uploadProductsDirEnv
    ? path.resolve(uploadProductsDirEnv)
    : null,

  uploadsRootEnv
    ? toProductsDir(uploadsRootEnv)
    : null,

  railwayVolumeRoot
    ? path.resolve(railwayVolumeRoot, "uploads", "products")
    : null,

  path.resolve("/data/uploads/products"),

  path.resolve(process.cwd(), "uploads/products"),

  path.resolve(__dirname, "../../uploads/products"),
];

const uploadRoot = findWritableDirectory(productUploadCandidates);

if (!uploadRoot) {
  throw new Error(
    "No writable upload directory available for product images."
  );
}

const persistentProductRoots = uniquePaths([
  uploadProductsDirEnv
    ? path.resolve(uploadProductsDirEnv)
    : null,

  uploadsRootEnv
    ? toProductsDir(uploadsRootEnv)
    : null,

  railwayVolumeRoot
    ? path.resolve(railwayVolumeRoot, "uploads", "products")
    : null,

  path.resolve("/data/uploads/products"),
]);

const usingPersistentProductDir =
  persistentProductRoots.includes(path.resolve(uploadRoot));

if (isProduction && !usingPersistentProductDir) {
  console.warn(
    `[UPLOAD] WARNING: Product uploads are using a non-persistent directory:\n${uploadRoot}\n` +
      "Configure UPLOAD_PRODUCTS_DIR, UPLOADS_ROOT, or RAILWAY_VOLUME_MOUNT_PATH."
  );
}

console.log(`[UPLOAD] Product image directory: ${uploadRoot}`);

/* =========================================================
   CATALOG UPLOAD DIRECTORY
========================================================= */

const catalogUploadCandidates = [
  uploadCatalogDirEnv
    ? path.resolve(uploadCatalogDirEnv)
    : null,

  uploadsRootEnv
    ? toCatalogDir(uploadsRootEnv)
    : null,

  railwayVolumeRoot
    ? path.resolve(railwayVolumeRoot, "uploads", "catalog")
    : null,

  path.resolve("/data/uploads/catalog"),

  path.resolve(process.cwd(), "uploads/catalog"),

  path.resolve(__dirname, "../../uploads/catalog"),
];

const catalogUploadRoot =
  findWritableDirectory(catalogUploadCandidates);

if (!catalogUploadRoot) {
  throw new Error(
    "No writable upload directory available for catalog images."
  );
}

const persistentCatalogRoots = uniquePaths([
  uploadCatalogDirEnv
    ? path.resolve(uploadCatalogDirEnv)
    : null,

  uploadsRootEnv
    ? toCatalogDir(uploadsRootEnv)
    : null,

  railwayVolumeRoot
    ? path.resolve(railwayVolumeRoot, "uploads", "catalog")
    : null,

  path.resolve("/data/uploads/catalog"),
]);

const usingPersistentCatalogDir =
  persistentCatalogRoots.includes(
    path.resolve(catalogUploadRoot)
  );

if (isProduction && !usingPersistentCatalogDir) {
  console.warn(
    `[UPLOAD] WARNING: Catalog uploads are using a non-persistent directory:\n${catalogUploadRoot}\n` +
      "Configure UPLOAD_CATALOG_DIR, UPLOADS_ROOT, or RAILWAY_VOLUME_MOUNT_PATH."
  );
}

console.log(
  `[UPLOAD] Catalog image directory: ${catalogUploadRoot}`
);

/* =========================================================
   IMAGE VALIDATION
========================================================= */

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

const validateImageFile = (file) => {
  if (!file) {
    return false;
  }

  const extension = path
    .extname(file.originalname || "")
    .toLowerCase();

  const mimeType = String(file.mimetype || "").toLowerCase();

  return (
    ALLOWED_EXTENSIONS.has(extension) &&
    ALLOWED_MIME_TYPES.has(mimeType)
  );
};

/* =========================================================
   SAFE FILENAME
========================================================= */

const createSafeCatalogFilename = (originalName) => {
  const extension =
    path.extname(originalName || ".jpg").toLowerCase();

  const originalBase = path.basename(
    originalName || "catalog-image",
    extension
  );

  const safeBase =
    originalBase
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 80) || "catalog-image";

  return `${safeBase}-${Date.now()}-${Math.round(
    Math.random() * 1e6
  )}${extension}`;
};

/* =========================================================
   PRODUCT IMAGE STORAGE
========================================================= */

const productStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadRoot);
  },

  filename(req, file, cb) {
    const extension =
      path.extname(file.originalname || ".jpg").toLowerCase();

    const unique =
      `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    cb(null, `${unique}${extension}`);
  },
});

const productFileFilter = (req, file, cb) => {
  if (!validateImageFile(file)) {
    return cb(
      new Error(
        "Only JPG, JPEG, PNG and WEBP images are allowed."
      )
    );
  }

  cb(null, true);
};

const upload = multer({
  storage: productStorage,
  fileFilter: productFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

/* =========================================================
   CATALOG IMAGE STORAGE
========================================================= */

const catalogStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, catalogUploadRoot);
  },

  filename(req, file, cb) {
    cb(
      null,
      createSafeCatalogFilename(file.originalname)
    );
  },
});

const catalogUpload = multer({
  storage: catalogStorage,

  fileFilter(req, file, cb) {
    if (!validateImageFile(file)) {
      return cb(
        new Error(
          "Only JPG, JPEG, PNG and WEBP images are allowed."
        )
      );
    }

    cb(null, true);
  },

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

/* =========================================================
   PRODUCT IMAGE UPLOAD
   POST /api/upload/product-image
========================================================= */

router.post(
  "/product-image",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No image file was uploaded.",
        });
      }

      if (
        !req.file.path ||
        !fs.existsSync(req.file.path)
      ) {
        return res.status(500).json({
          success: false,
          error:
            "The uploaded image could not be found after saving.",
        });
      }

      return res.status(201).json({
        success: true,
        image_url: `/uploads/products/${req.file.filename}`,
        filename: req.file.filename,
      });
    } catch (err) {
      console.error(
        "[UPLOAD] Product image error:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err.message || "Product image upload failed.",
      });
    }
  }
);

/* =========================================================
   CATALOG IMAGE UPLOAD
   POST /api/upload/catalog
========================================================= */

router.post(
  "/catalog",
  verifyToken,
  isAdmin,
  catalogUpload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Image is required.",
        });
      }

      if (
        !req.file.path ||
        !fs.existsSync(req.file.path)
      ) {
        return res.status(500).json({
          success: false,
          error:
            "The uploaded catalog image could not be found after saving.",
        });
      }

      const imageUrl =
        `/uploads/catalog/${req.file.filename}`;

      console.log(
        `[UPLOAD] Catalog image saved: ${req.file.path}`
      );

      console.log(
        `[UPLOAD] Catalog image URL: ${imageUrl}`
      );

      return res.status(201).json({
        success: true,
        image_url: imageUrl,
        filename: req.file.filename,
      });
    } catch (err) {
      console.error(
        "[UPLOAD] Catalog image error:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err.message || "Catalog image upload failed.",
      });
    }
  }
);

/* =========================================================
   UPLOAD ERROR HANDLER
========================================================= */

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("[UPLOAD] Multer error:", err);

    let message = "Image upload failed.";

    if (err.code === "LIMIT_FILE_SIZE") {
      message =
        "Image is too large. Maximum allowed size is 5MB.";
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      message = "Only one image can be uploaded at a time.";
    }

    return res.status(400).json({
      success: false,
      error: message,
      code: err.code,
    });
  }

  if (err && err.message) {
    console.error(
      "[UPLOAD] File validation error:",
      err
    );

    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  next(err);
});

/* =========================================================
   EXPORT
========================================================= */

module.exports = router;