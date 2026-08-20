const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const jwtSecret = process.env.JWT_SECRET || "elohim_123456";

/* =========================
   VERIFY TOKEN
========================= */
const verifyToken = async (req, res, next) => {
  try {
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

module.exports = { verifyToken, isAdmin };