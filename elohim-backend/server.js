require('dotenv').config();

const app = require('./src/app');

const PORT = process.env.PORT || 5000;

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