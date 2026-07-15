const jwt = require("jsonwebtoken");
const pool = require("../config/db");

/* =========================
   VERIFY TOKEN
========================= */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
    console.error(err);
    res.status(401).json({ error: "Invalid token" });
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