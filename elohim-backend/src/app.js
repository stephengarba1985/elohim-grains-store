const express = require('express');
const cors = require('cors');
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

// ✅ KEEP ONLY THIS (MAIN BULK SYSTEM)
const bulkRoutes = require("./routes/bulkRoutes");

// ✅ PAYMENT ROUTE
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();
const isDev = process.env.NODE_ENV === "development";

/* =========================
   MIDDLEWARE
========================= */
app.use(cors({
  origin: "*", // 🔥 Change to your frontend URL in production
  credentials: true
}));

app.use(express.json());

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
app.use("/api/admin", adminRoutes);
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

// ✅ SINGLE BULK ENTRY POINT
app.use("/api/bulk", bulkRoutes);

// ✅ PAYMENT
app.use("/api/payment", paymentRoutes);

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
  console.error("🔥 GLOBAL ERROR:", err.stack);

  res.status(500).json({
    error: "Something went wrong",
    detail:
      process.env.NODE_ENV === "development"
        ? err.message
        : undefined
  });
});

module.exports = app;
