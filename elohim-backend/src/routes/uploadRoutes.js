const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const router = express.Router();

const uploadsRoot = process.env.UPLOADS_ROOT;
const railwayVolumeRoot = process.env.RAILWAY_VOLUME_MOUNT_PATH;

const candidateUploadRoots = [
  uploadsRoot ? path.resolve(uploadsRoot, "products") : null,
  railwayVolumeRoot ? path.resolve(railwayVolumeRoot, "uploads/products") : null,
  path.resolve("/data/uploads/products"),
  process.env.UPLOAD_PRODUCTS_DIR,
  path.resolve(process.cwd(), "uploads/products"),
  path.resolve(__dirname, "../../uploads/products"),
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