const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be configured in the production deployment environment.");
}

// Production traffic always uses TLS. Some managed providers (including private
// Railway Postgres connections) use a provider certificate chain which Node does
// not trust by default; supply DB_SSL_CA to enable strict verification there.
const hasProviderCa = Boolean(process.env.DB_SSL_CA);
const ssl = isProduction
  ? {
      rejectUnauthorized: hasProviderCa || process.env.DB_SSL_REJECT_UNAUTHORIZED === "true",
      ...(hasProviderCa ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, "\n") } : {}),
    }
  : process.env.DB_SSL === "true"
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" }
    : undefined;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
});

module.exports = pool
