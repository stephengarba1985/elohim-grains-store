const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

const uploadsRoot = process.env.UPLOADS_ROOT;
const railwayVolumeRoot = process.env.RAILWAY_VOLUME_MOUNT_PATH;
const uploadProductsDir = process.env.UPLOAD_PRODUCTS_DIR;
const isProduction = process.env.NODE_ENV === "production";

const toProductsDir = (rootPath) => {
  if (!rootPath) return null;

  const resolved = path.resolve(rootPath);
  return path.basename(resolved).toLowerCase() === "products"
    ? resolved
    : path.join(resolved, "products");
};

const persistentUploadRoots = [
  toProductsDir(uploadProductsDir),
  uploadsRoot ? toProductsDir(uploadsRoot) : null,
  railwayVolumeRoot ? path.resolve(railwayVolumeRoot, "uploads/products") : null,
  path.resolve("/data/uploads/products"),
].filter(Boolean);

const fallbackUploadRoots = [
  path.resolve(process.cwd(), "uploads/products"),
  path.resolve(__dirname, "../../uploads/products"),
];

const candidateUploadRoots = [
  ...persistentUploadRoots,
  ...fallbackUploadRoots,
].filter(Boolean);

let uploadRoot = null;

for (const candidate of candidateUploadRoots) {
  try {
    fs.mkdirSync(candidate, { recursive: true });
    fs.accessSync(candidate, fs.constants.W_OK);
    uploadRoot = candidate;
    break;
  } catch (err) {
    // Try next candidate path.
  }
}

if (!uploadRoot) {
  throw new Error("No writable upload directory available for product images");
}

const usingFallbackDir = fallbackUploadRoots.includes(uploadRoot);
if (isProduction && usingFallbackDir) {
  console.warn(
    `[UPLOAD] Using fallback non-persistent directory in production: ${uploadRoot}. ` +
      "Set UPLOADS_ROOT or RAILWAY_VOLUME_MOUNT_PATH for persistent storage."
  );
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadRoot);
  },

  filename(req, file, cb) {
    const unique =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(
      null,
      unique + path.extname(file.originalname)
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpg|jpeg|png|webp/i;

  const ext = allowed.test(path.extname(file.originalname));

  const mime = allowed.test(file.mimetype);

  if (ext && mime) {
    return cb(null, true);
  }

  cb(new Error("Only JPG, PNG and WEBP images are allowed"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const catalogUploadRoot = (() => {
  const candidates = [
    path.resolve(process.cwd(), "uploads/catalog"),
    path.resolve(__dirname, "../../uploads/catalog"),
    path.resolve("/data/uploads/catalog"),
  ];

  for (const candidate of candidates) {
    try {
      fs.mkdirSync(candidate, { recursive: true });
      fs.accessSync(candidate, fs.constants.W_OK);
      return candidate;
    } catch (err) {
      // Try the next candidate.
    }
  }

  return path.resolve(process.cwd(), "uploads/catalog");
})();

const catalogStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, catalogUploadRoot);
  },
  filename(req, file, cb) {
    const extension = path.extname(file.originalname || ".jpg");
    const base = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .toLowerCase();

    cb(null, `${base}-${Date.now()}${extension}`);
  },
});

const catalogUpload = multer({
  storage: catalogStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG and WebP images are allowed"));
    }

    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.post(
  "/product-image",
  upload.single("image"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No image file was uploaded",
      });
    }

    if (!req.file?.path || !fs.existsSync(req.file.path)) {
      return res.status(500).json({
        success: false,
        error: "Image upload saved file could not be found",
      });
    }

    res.json({
      success: true,
      image_url: `/uploads/products/${req.file.filename}`,
    });
  }
);

router.post(
  "/catalog",
  verifyToken,
  isAdmin,
  catalogUpload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Image is required",
        });
      }

      const imageUrl = `/uploads/catalog/${req.file.filename}`;
      res.status(201).json({
        success: true,
        image_url: imageUrl,
        filename: req.file.filename,
      });
    } catch (err) {
      console.error("IMAGE UPLOAD ERROR:", err);
      res.status(500).json({
        error: err.message || "Image upload failed",
      });
    }
  }
);

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    console.error("Upload error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Image upload failed",
    });
  }

  next(err);
});

module.exports = router;