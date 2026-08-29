const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

require("dotenv").config();

const pool = require("./config/db");

/* =========================================================
   ROUTES IMPORT
========================================================= */

const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
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
const {
  router: paymentGatewayRoutes,
} = require("./routes/paymentGatewayRoutes");
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
const paymentRoutes = require("./routes/paymentRoutes");

/* =========================================================
   APP
========================================================= */

const app = express();

app.disable("x-powered-by");

/*
 * Railway / reverse proxy support.
 */
app.set("trust proxy", 1);

/* =========================================================
   ENVIRONMENT
========================================================= */

const isDev =
  process.env.NODE_ENV === "development";

const uploadsRootEnv =
  process.env.UPLOADS_ROOT;

const railwayVolumeRoot =
  process.env.RAILWAY_VOLUME_MOUNT_PATH;

const uploadProductsDirEnv =
  process.env.UPLOAD_PRODUCTS_DIR;

const uploadCatalogDirEnv =
  process.env.UPLOAD_CATALOG_DIR;

/* =========================================================
   UPLOAD PATH HELPERS
========================================================= */

const toUploadsRoot = (rootPath) => {
  if (!rootPath) return null;

  const resolved = path.resolve(rootPath);
  const base = path.basename(resolved).toLowerCase();

  if (base === "uploads") {
    return resolved;
  }

  return path.join(resolved, "uploads");
};

const uniquePaths = (paths) => {
  return Array.from(
    new Set(
      paths
        .filter(Boolean)
        .map((item) => path.resolve(item))
    )
  );
};

/* =========================================================
   STATIC UPLOAD DIRECTORIES
========================================================= */

const uploadStaticRoots = uniquePaths([
  uploadProductsDirEnv
    ? path.dirname(path.resolve(uploadProductsDirEnv))
    : null,

  uploadCatalogDirEnv
    ? path.dirname(path.resolve(uploadCatalogDirEnv))
    : null,

  uploadsRootEnv
    ? toUploadsRoot(uploadsRootEnv)
    : null,

  railwayVolumeRoot
    ? path.resolve(railwayVolumeRoot, "uploads")
    : null,

  path.resolve("/data/uploads"),

  path.resolve(process.cwd(), "uploads"),

  path.resolve(__dirname, "..", "uploads"),
]);

console.log(
  "[UPLOAD] Static upload roots:"
);

uploadStaticRoots.forEach((dir) => {
  console.log(`  - ${dir}`);
});

/* =========================================================
   HELMET
========================================================= */

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

/* =========================================================
   RATE LIMITERS
========================================================= */

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
    message:
      "Too many login attempts. Please try again in 15 minutes.",
  },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many upload requests. Please try again in 15 minutes.",
  },
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many payment verification requests. Please try again in 15 minutes.",
  },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many admin requests. Please try again in 15 minutes.",
  },
});

/* =========================================================
   CORS
========================================================= */

const allowedOrigins = new Set(
  [
    "https://elohimgrains.com",
    "https://www.elohimgrains.com",

    "https://elohim-grains-store-production.up.railway.app",
    "https://elohim-grains-store.up.railway.app",

    "http://localhost:3000",
    "http://localhost:3001",

    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",

    "https://localhost:3000",
    "https://localhost:3001",

    process.env.FRONTEND_URL,
  ].filter(Boolean)
);

const corsOptions = {
  origin(origin, callback) {
    /*
     * Allow server-to-server requests, curl, health checks,
     * mobile clients, etc. that do not send Origin.
     */
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    const isAllowedHost =
      origin.includes("localhost") ||
      origin.endsWith(".railway.app") ||
      origin.endsWith(".vercel.app") ||
      origin.endsWith(".elohimgrains.com");

    if (isAllowedHost) {
      return callback(null, true);
    }

    const corsError =
      new Error("Not allowed by CORS");

    corsError.status = 403;

    return callback(corsError);
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
  ],
};

/* =========================================================
   GENERAL MIDDLEWARE
========================================================= */

app.use(cors(corsOptions));

app.options(
  /^(.*)$/,
  cors(corsOptions)
);

app.use("/api", apiLimiter);

app.use("/api/auth", authLimiter);

/*
 * Payment webhooks must receive raw JSON.
 */
app.use(
  "/api/payment/webhook",
  express.raw({
    type: "application/json",
  })
);

app.use(
  "/api/wallet/webhook",
  express.raw({
    type: "application/json",
  })
);

app.use(express.json());

/* =========================================================
   UPLOAD IMAGE SERVING
========================================================= */

/**
 * Only allow a simple filename.
 *
 * This prevents paths such as:
 *   ../../some-file
 */
const isSafeFilename = (filename) => {
  if (!filename) {
    return false;
  }

  return (
    filename === path.basename(filename) &&
    !filename.includes("..") &&
    !filename.includes("/") &&
    !filename.includes("\\")
  );
};

/**
 * Find an uploaded file in all configured upload roots.
 */
const findUploadedFile = (
  folder,
  filename
) => {
  if (!isSafeFilename(filename)) {
    return null;
  }

  for (const uploadRoot of uploadStaticRoots) {
    const candidate = path.resolve(
      uploadRoot,
      folder,
      filename
    );

    /*
     * Ensure candidate is actually inside uploadRoot.
     */
    const expectedRoot = path.resolve(
      uploadRoot,
      folder
    );

    if (
      !candidate.startsWith(
        expectedRoot + path.sep
      )
    ) {
      continue;
    }

    try {
      if (
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
      ) {
        return candidate;
      }
    } catch (err) {
      console.error(
        `[UPLOAD] Failed checking file: ${candidate}`,
        err.message
      );
    }
  }

  return null;
};

/**
 * Serve product and catalog images.
 *
 * Examples:
 *   /uploads/products/image.jpg
 *   /uploads/catalog/rice.jpg
 */
app.get(
  [
    "/uploads/products/:filename",
    "/uploads/catalog/:filename",
  ],
  (req, res) => {
    const filename = req.params.filename;

    const folder = req.path.includes(
      "/catalog/"
    )
      ? "catalog"
      : "products";

    const filePath = findUploadedFile(
      folder,
      filename
    );

    if (!filePath) {
      console.warn(
        `[UPLOAD] Image not found: /uploads/${folder}/${filename}`
      );

      return res.status(404).json({
        success: false,
        error: "Image not found",
        path: `/uploads/${folder}/${filename}`,
      });
    }

    return res.sendFile(filePath);
  }
);

/* =========================================================
   DEVELOPMENT REQUEST LOGGING
========================================================= */

if (isDev) {
  app.use((req, res, next) => {
    console.debug(
      `${req.method} ${req.originalUrl}`
    );

    next();
  });
}

/* =========================================================
   API ROUTES
========================================================= */

app.use(
  "/api/products",
  productRoutes
);

app.use(
  "/api/cart",
  cartRoutes
);

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/orders",
  orderRoutes
);

app.use(
  "/api/riders",
  riderRoutes
);

app.use(
  "/api/tracking",
  trackingRoutes
);

app.use(
  "/api/subscriptions",
  subscriptionRoutes
);

app.use(
  "/api/admin",
  adminLimiter,
  adminRoutes
);

app.use(
  "/api/plans",
  plansRoute
);

app.use(
  "/api/wallet",
  walletRoutes
);

app.use(
  "/api/bnpl",
  bnplRoutes
);

app.use(
  "/api/cooperatives",
  cooperativeRoutes
);

app.use(
  "/api/price-insights",
  priceInsightsRoutes
);

app.use(
  "/api/escrow",
  escrowRoutes
);

app.use(
  "/api/payment-gateways",
  paymentGatewayRoutes
);

app.use(
  "/api/vendors",
  vendorMarketplaceRoutes
);

app.use(
  "/api/inventory-finance",
  inventoryFinanceRoutes
);

app.use(
  "/api/warehouse",
  warehouseRoutes
);

app.use(
  "/api/kyc",
  kycRoutes
);

app.use(
  "/api/ai-assistant",
  aiAssistantRoutes
);

app.use(
  "/api/mobile",
  mobileRoutes
);

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/customers",
  customerRoutes
);

app.use(
  "/api/categories",
  categoryRoutes
);

app.use(
  "/api/product-types",
  productTypeRoutes
);

app.use(
  "/api/catalog",
  catalogRoutes
);

/*
 * Main bulk system.
 */
app.use(
  "/api/bulk",
  bulkRoutes
);

/*
 * Upload routes.
 *
 * Both are retained for compatibility with your existing
 * frontend/backend code.
 *
 * /api/upload/catalog
 * /api/uploads/catalog
 */
app.use(
  "/api/upload",
  uploadLimiter,
  uploadRoutes
);

app.use(
  "/api/uploads",
  uploadRoutes
);

/*
 * Payment.
 */
app.use(
  "/api/payment",
  paymentLimiter,
  paymentRoutes
);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          "SELECT NOW()"
        );

      return res.json({
        status: "OK",
        message:
          "Elohim Grains API Running",
        time: result.rows[0],
      });
    } catch (err) {
      console.error(
        "[HEALTH] Database error:",
        err
      );

      return res.status(500).json({
        status: "ERROR",
        error:
          "Database connection failed",
      });
    }
  }
);

/* =========================================================
   INDEXING STATUS
========================================================= */

app.get(
  [
    "/api/indexing-status",
    "/api/index-status",
  ],
  async (req, res) => {
    try {
      const result =
        await pool.query(
          "SELECT NOW()"
        );

      return res.status(200).json({
        success: true,
        status: "healthy",
        message:
          "Indexing status check passed",
        database: "online",
        timestamp:
          new Date().toISOString(),
        time: result.rows[0],
      });
    } catch (err) {
      console.error(
        "Indexing status check failed:",
        err
      );

      return res.status(503).json({
        success: false,
        status: "unhealthy",
        message:
          "Indexing status unavailable",
        database: "offline",
        timestamp:
          new Date().toISOString(),
      });
    }
  }
);

/* =========================================================
   ROOT ROUTE
========================================================= */

app.get(
  "/",
  (req, res) => {
    res.json({
      message:
        "🚀 Elohim Grains API Live",
    });
  }
);

/* =========================================================
   ROBOTS.TXT
========================================================= */

app.get(
  "/robots.txt",
  (req, res) => {
    const siteUrl =
      process.env.FRONTEND_URL ||
      "https://www.elohimgrains.com";

    res.type("text/plain");

    res.send(
      `User-agent: *
Allow: /
Sitemap: ${siteUrl}/sitemap.xml
`
    );
  }
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use(
  (req, res) => {
    console.warn(
      `❌ Route not found: ${req.method} ${req.originalUrl}`
    );

    return res.status(404).json({
      success: false,
      error: "Route not found",
      path: req.originalUrl,
    });
  }
);

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (err, req, res, next) => {
    console.error(
      "GLOBAL ERROR:",
      err
    );

    return res
      .status(err.status || 500)
      .json({
        success: false,

        message:
          process.env.NODE_ENV ===
          "development"
            ? err.message
            : "Internal server error",
      });
  }
);

/* =========================================================
   EXPORT
========================================================= */

module.exports = app;