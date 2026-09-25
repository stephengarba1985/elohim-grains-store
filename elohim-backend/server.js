require('dotenv').config();

const app = require('./src/app');

const PORT = process.env.PORT || 5000;

const requiredProductionEnv = ["DATABASE_URL", "JWT_SECRET", "PAYSTACK_SECRET_KEY", "FRONTEND_URL"];
if (process.env.NODE_ENV === "production") {
  const missing = requiredProductionEnv.filter((name) => !String(process.env[name] || "").trim());
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }
}

/* =========================
   CRON SETUP (SAFE)
========================= */
const cron = require("node-cron");

// ✅ FIX PATH (IMPORTANT)
let runSubscriptions;

try {
  runSubscriptions = require("./src/utils/subscriptionJob"); // 🔥 adjust if needed
} catch (err) {
  console.error("❌ Failed to load subscriptionJob:", err.message);
}

/* =========================
   START SERVER FIRST
========================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);

  /* =========================
     START CRON AFTER SERVER
  ========================= */
  if (runSubscriptions) {
    cron.schedule("0 0 * * *", async () => {
      console.log("⏰ Running daily subscription job...");

      try {
        await runSubscriptions();
      } catch (err) {
        console.error("❌ CRON ERROR:", err.message);
      }
    });

    console.log("✅ Cron job scheduled");
  }
});