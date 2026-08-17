const express = require('express');
const cors = require('cors');
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
require('dotenv').config(); // ✅ LOAD ENV VARIABLES

const pool = require('./config/db');

/* =========================
   ROUTES IMPORT
========================= */
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const riderRoutes = require("./routes/riderRoutes");
const { router: trackingRoutes } = require("./routes/trackingRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const adminRoutes = require("./routes/adminRoutes");
const plansRoute = require("./routes/plans");
const { router: walletRoutes } = require("./routes/walletRoutes");
const bnplRoutes = require("./routes/bnplRoutes");
const cooperativeRoutes = require("./routes/cooperativeRoutes");
const priceInsightsRoutes = require("./routes/priceInsightsRoutes");
const { router: escrowRoutes } = require("./routes/escrowRoutes");
const { router: paymentGatewayRoutes } = require("./routes/paymentGatewayRoutes");
const vendorMarketplaceRoutes = require("./routes/vendorMarketplaceRoutes");
const inventoryFinanceRoutes = require("./routes/inventoryFinanceRoutes");
const warehouseRoutes = require("./routes/warehouseRoutes");
const kycRoutes = require("./routes/kycRoutes");
const aiAssistantRoutes = require("./routes/aiAssistantRoutes");
const { router: mobileRoutes } = require("./routes/mobileRoutes");
const userRoutes = require("./routes/userRoutes");
const bulkRoutes = require("./routes/bulkRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const customerRoutes = require("./routes/customerRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productTypeRoutes = require("./routes/productTypeRoutes");
const catalogRoutes = require("./routes/catalogRoutes");

// ✅ PAYMENT ROUTE
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many upload requests. Please try again in 15 minutes.",
  },
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many payment verification requests. Please try again in 15 minutes.",
  },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many admin requests. Please try again in 15 minutes.",
  },
});

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

const isDev = process.env.NODE_ENV === "development";
const uploadsRoot = process.env.UPLOADS_ROOT;
const railwayVolumeRoot = process.env.RAILWAY_VOLUME_MOUNT_PATH;
const allowedOrigins = [
  "https://elohimgrains.com",
  "https://www.elohimgrains.com",
  process.env.FRONTEND_URL,
].filter(Boolean);

/* =========================
   MIDDLEWARE
========================= */
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const corsError = new Error("Not allowed by CORS");
      corsError.status = 403;
      return callback(corsError);
    },
    credentials: true,
  })
);

app.use("/api/payment/webhook", express.raw({ type: "application/json" }));
app.use("/api/wallet/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

const uploadStaticDirs = [
  uploadsRoot,
  railwayVolumeRoot ? path.resolve(railwayVolumeRoot, "uploads") : null,
  path.resolve("/data/uploads"),
  path.join(__dirname, "..", "uploads"),
  path.resolve(process.cwd(), "uploads"),
].filter(Boolean);

app.get(["/uploads/products/:filename", "/uploads/catalog/:filename"], (req, res, next) => {
  const { filename } = req.params;
  const folder = req.path.includes("/catalog/") ? "catalog" : "products";

  for (const uploadDir of uploadStaticDirs) {
    const candidate = path.join(uploadDir, folder, filename);
    if (fs.existsSync(candidate)) {
      return res.sendFile(candidate);
    }
  }

  const fallbackSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
      <rect width="800" height="600" fill="#f3f4f6"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif" font-size="28">
        Image not available
      </text>
    </svg>
  `;

  res.setHeader("Content-Type", "image/svg+xml");
  return res.status(200).send(fallbackSvg);
});

Array.from(new Set(uploadStaticDirs)).forEach((dir) => {
  app.use("/uploads", express.static(dir));
});

if (isDev) {
  app.use((req, res, next) => {
    console.debug(`${req.method} ${req.originalUrl}`);
    next();
  });
}

/* =========================
   API ROUTES
========================= */
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use("/api/riders", riderRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/admin", adminLimiter, adminRoutes);
app.use("/api/plans", plansRoute);
app.use("/api/wallet", walletRoutes);
app.use("/api/bnpl", bnplRoutes);
app.use("/api/cooperatives", cooperativeRoutes);
app.use("/api/price-insights", priceInsightsRoutes);
app.use("/api/escrow", escrowRoutes);
app.use("/api/payment-gateways", paymentGatewayRoutes);
app.use("/api/vendors", vendorMarketplaceRoutes);
app.use("/api/inventory-finance", inventoryFinanceRoutes);
app.use("/api/warehouse", warehouseRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/ai-assistant", aiAssistantRoutes);
app.use("/api/mobile", mobileRoutes);
app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/product-types", productTypeRoutes);
app.use("/api/catalog", catalogRoutes);
// ✅ KEEP ONLY THIS (MAIN BULK SYSTEM)
// ✅ SINGLE BULK ENTRY POINT
app.use("/api/bulk", bulkRoutes);
app.use("/api/upload", uploadLimiter, uploadRoutes);
app.use("/api/uploads", uploadRoutes);

// ✅ PAYMENT
app.use("/api/payment", paymentLimiter, paymentRoutes);

/* =========================
   HEALTH CHECK ROUTE
========================= */
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');

    res.json({
      status: "OK",
      message: "Elohim Grains API Running",
      time: result.rows[0]
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Database connection failed",
    });
  }
});

/* =========================
   ROOT ROUTE
========================= */
app.get('/', (req, res) => {
  res.json({
    message: "🚀 Elohim Grains API Live",
  });
});

/* =========================
   404 HANDLER (VERY IMPORTANT)
========================= */
app.use((req, res) => {
  console.warn(`❌ Route not found: ${req.method} ${req.originalUrl}`);

  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl
  });
});

/* =========================
   GLOBAL ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

module.exports = app;
