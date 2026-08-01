const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const router = express.Router();

const uploadRoot = path.resolve(__dirname, "../../uploads/products");

fs.mkdirSync(uploadRoot, { recursive: true });

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