// api/middleware/auth.js
const jwt = require("jsonwebtoken");
const pool = require("../database/database");

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user (equivalent to Supabase select + eq + single)
    const userResult = await pool.query(
      `
      SELECT id, email, is_active
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [decoded.userId]
    );

    const user = userResult.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({ error: "Invalid or inactive user" });
    }

    req.user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

const authorize = (roles = []) => {
  return async (req, res, next) => {
    try {
      // Fetch user roles (Supabase relation -> SQL JOIN)
      const rolesResult = await pool.query(
        `
        SELECT r.name
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = $1
        `,
        [req.user.id]
      );

      const userRoles = rolesResult.rows.map((row) => row.name);

      if (roles.length > 0 && !roles.some((role) => userRoles.includes(role))) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      req.user.roles = userRoles;
      next();
    } catch (error) {
      console.error("Authorization error:", error);
      return res.status(500).json({ error: "Authorization check failed" });
    }
  };
};

module.exports = { authenticateToken, authorize };
















