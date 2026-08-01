const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, "uploads/products");
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
    res.json({
      success: true,
      image_url: `/uploads/products/${req.file.filename}`,
    });
  }
);

module.exports = router;