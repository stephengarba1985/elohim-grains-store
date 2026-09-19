const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const jwtSecret = process.env.JWT_SECRET || "elohim_123456";
let staffRolesReady = false;
const ensureStaffRoles = async () => {
  if (staffRolesReady) return;
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_role VARCHAR(40)");
  await pool.query("UPDATE users SET staff_role='super_admin' WHERE COALESCE(is_admin,false)=true AND staff_role IS NULL");
  staffRolesReady = true;
};

const ROLE_PERMISSIONS = {
  super_admin: ["*"],
  operations_manager: ["dashboard", "orders", "products", "inventory", "deliveries", "customers", "bulk", "subscriptions"],
  finance: ["dashboard", "payments", "wallet", "savings", "bnpl", "reports", "ledger", "profit"],
  warehouse: ["orders", "inventory", "products"],
  delivery_manager: ["deliveries", "riders", "orders"],
  customer_support: ["customers", "orders"],
  vendor_manager: ["vendors", "products"],
};

/* =========================
   VERIFY TOKEN
========================= */
const verifyToken = async (req, res, next) => {
  try {
    await ensureStaffRoles();
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || typeof authHeader !== "string") {
      return res.status(401).json({ error: "No token provided" });
    }

    const parts = authHeader.split(" ");
    const token = parts.length === 2 ? parts[1] : authHeader;

    if (!token || token === "undefined" || token === "null") {
      return res.status(401).json({ error: "Invalid token format" });
    }

    const decoded = jwt.verify(token, jwtSecret);

    const result = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = result.rows[0];
    req.auth = decoded;
    next();

  } catch (err) {
    console.error("JWT VERIFY ERROR:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

/* =========================
   CHECK ADMIN
========================= */
const isAdmin = (req, res, next) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: "Admin access only" });
  }

  next();
};

const requirePermission = (permission) => (req, res, next) => {
  if (!req.user?.is_admin) return res.status(403).json({ error: "Admin access only" });
  const permissions = ROLE_PERMISSIONS[req.user.staff_role] || [];
  if (!permissions.includes("*") && !permissions.includes(permission)) return res.status(403).json({ error: "Your staff role does not have permission for this action" });
  next();
};

const requireRecentAuth = (maxAgeMinutes = 30) => (req, res, next) => {
  const authTime = Number(req.auth?.auth_time || 0);
  if (!authTime || Date.now() / 1000 - authTime > maxAgeMinutes * 60) return res.status(401).json({ error: "Please sign in again to complete this sensitive action." });
  next();
};

module.exports = { verifyToken, isAdmin, requirePermission, requireRecentAuth, ROLE_PERMISSIONS, ensureStaffRoles };
