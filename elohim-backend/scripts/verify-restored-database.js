/*
 * Run only against an isolated restored database:
 *   DATABASE_URL=... npm run verify:restore
 *
 * It checks that the business-critical tables survived a restore and prints
 * counts only; it never reads or exports customer records.
 */
require("dotenv").config();
const { Client } = require("pg");

const requiredTables = [
  "users",
  "products",
  "orders",
  "order_items",
  "order_status_events",
  "payment_transactions",
  "wallet_transactions",
  "financial_ledger",
  "grain_plans",
  "grain_plan_payments",
  "stock_history",
  "vendor_payouts",
  "admin_audit_log",
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (process.env.RESTORE_VALIDATION !== "true") {
    throw new Error("Set RESTORE_VALIDATION=true to confirm this is an intentional restore check.");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
  });
  await client.connect();
  try {
    const existing = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1::text[])",
      [requiredTables]
    );
    const found = new Set(existing.rows.map((row) => row.table_name));
    const missing = requiredTables.filter((table) => !found.has(table));
    if (missing.length) throw new Error(`Restore validation failed. Missing tables: ${missing.join(", ")}`);

    const counts = {};
    for (const table of requiredTables) {
      const result = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${table}`);
      counts[table] = result.rows[0].count;
    }
    console.table(counts);
    console.log("Restore validation passed: all critical tables are present.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
