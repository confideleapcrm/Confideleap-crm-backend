// api/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const crypto = require("crypto");

const pool = require("../database/database");
const { validateRequest } = require("../middleware/validation");
const { generateAccessToken, generateSessionToken } = require("../utils/token");
const passport = require("passport");
require("../config/passport");

const router = express.Router();

/* ------------------------------------------------------------------
   Validation schemas
------------------------------------------------------------------- */
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  jobTitle: Joi.string().allow(null, ""),
  department: Joi.string().allow(null, ""),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  rememberMe: Joi.boolean().optional(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required(),
});

/* ------------------------------------------------------------------
   REGISTER
------------------------------------------------------------------- */
router.post("/register", validateRequest(registerSchema), async (req, res) => {
  try {
    const { email, password, firstName, lastName, jobTitle, department } =
      req.body;

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const userResult = await pool.query(
      `
      INSERT INTO users (
        email, password_hash, first_name, last_name, job_title, department
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id, email, first_name, last_name, created_at
      `,
      [email, hashedPassword, firstName, lastName, jobTitle, department]
    );

    const user = userResult.rows[0];

    const roleResult = await pool.query(
      "SELECT id FROM roles WHERE name = 'user' LIMIT 1"
    );

    if (roleResult.rows.length === 0) {
      return res.status(500).json({ error: "Default role not found" });
    }

    await pool.query(
      "INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2)",
      [user.id, roleResult.rows[0].id]
    );

    res.status(201).json({
      message: "User registered successfully",
      user,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

/* ------------------------------------------------------------------
   LOGIN
------------------------------------------------------------------- */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, job_title, department, avatar_url, is_active
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: "Account disabled" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [
      user.id,
    ]);

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });
    const sessionToken = generateSessionToken();
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO user_sessions (user_id, session_token, expires_at)
       VALUES ($1,$2,$3)`,
      [user.id, sessionToken, expiry]
    );

    // 🍪 Set cookies
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // true in prod with https
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("sessionToken", sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        jobTitle: user.job_title,
        department: user.department,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

/* ------------------------------------------------------------------
   REFRESH ACCESS TOKEN
------------------------------------------------------------------- */
router.post("/refresh-token", async (req, res) => {
  const { sessionToken } = req.body;

  if (!sessionToken) {
    return res.status(401).json({ error: "Missing session token" });
  }

  try {
    const result = await pool.query(
      `
      SELECT u.id, u.email, u.first_name, u.last_name
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.session_token = $1
        AND s.expires_at > NOW()
      `,
      [sessionToken]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const user = result.rows[0];

    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    return res.json({
      accessToken: newAccessToken,
      userInfo: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    res.status(500).json({ error: "Token refresh failed" });
  }
});

/* ------------------------------------------------------------------
   FORGOT PASSWORD
------------------------------------------------------------------- */
router.post(
  "/forgot-password",
  validateRequest(forgotPasswordSchema),
  async (req, res) => {
    try {
      const { email } = req.body;

      const userResult = await pool.query(
        "SELECT id FROM users WHERE email = $1",
        [email]
      );

      if (userResult.rows.length === 0) {
        return res.json({
          message:
            "If an account with that email exists, a password reset link has been sent.",
        });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await pool.query(
        `
        INSERT INTO password_reset_tokens (user_id, token, expires_at)
        VALUES ($1,$2,$3)
        `,
        [userResult.rows[0].id, resetToken, expiresAt]
      );

      res.json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
        resetToken,
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  }
);

/* ------------------------------------------------------------------
   RESET PASSWORD
------------------------------------------------------------------- */
router.post(
  "/reset-password",
  validateRequest(resetPasswordSchema),
  async (req, res) => {
    const { token, password } = req.body;

    try {
      const tokenResult = await pool.query(
        `
        SELECT id, user_id
        FROM password_reset_tokens
        WHERE token = $1
          AND expires_at > NOW()
          AND used_at IS NULL
        `,
        [token]
      );

      if (tokenResult.rows.length === 0) {
        return res
          .status(400)
          .json({ error: "Invalid or expired reset token" });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
        hashedPassword,
        tokenResult.rows[0].user_id,
      ]);

      await pool.query(
        "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1",
        [tokenResult.rows[0].id]
      );

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  }
);

/* ------------------------------------------------------------------
   LOGOUT
------------------------------------------------------------------- */
router.post("/logout", async (req, res) => {
  const { sessionToken } = req.cookies.sessionToken;

  if (sessionToken) {
    await pool.query("DELETE FROM user_sessions WHERE session_token = $1", [
      sessionToken,
    ]);
  }

  res.clearCookie("accessToken");
  res.clearCookie("sessionToken");

  res.json({ message: "Logged out successfully", success: true });
});

/* ------------------------------------------------------------------
   VERIFY SESSION
------------------------------------------------------------------- */
router.get("/verify-session", async (req, res) => {
  try {
    const sessionToken = req.cookies.sessionToken;

    if (!sessionToken) {
      return res.status(401).json({ error: "No session token provided" });
    }

    const result = await pool.query(
      `
      SELECT us.*, u.*
      FROM user_sessions us
      JOIN users u ON u.id = us.user_id
      WHERE us.session_token = $1
      `,
      [sessionToken]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Session not found" });
    }

    const session = result.rows[0];

    if (!session.is_active) {
      return res
        .status(403)
        .json({ error: "Unauthorized or session is not active" });
    }

    if (new Date(session.expires_at) <= new Date()) {
      return res.status(401).json({ error: "Session expired" });
    }

    // Generate the access token
    const accessToken = generateAccessToken({
      userId: session.user_id,
      email: session.email,
    });

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 15 * 60 * 1000, // 15 min
    });

    res.json({
      userInfo: {
        id: session.user_id,
        email: session.email,
        firstName: session.first_name,
        lastName: session.last_name,
        jobTitle: session.job_title,
        department: session.department,
        avatarUrl: session.avatar_url,
      },
      // accessToken,
      // sessionToken,
    });
  } catch (error) {
    console.error("Verify session error:", error);
    res.status(500).json({ error: "Session verification failed" });
  }
});

/* ------------------------------------------------------------------
   ME
------------------------------------------------------------------- */
router.get("/me", async (req, res) => {
  try {
    // const token = req.headers.authorization?.split(" ")[1];

    const token = req.cookies.accessToken;

    if (!token) return res.status(401).json({ error: "Access token required" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      `
      SELECT id, email, first_name, last_name, job_title, department,
             avatar_url, phone, bio, timezone, language, theme,
             created_at, last_login_at
      FROM users
      WHERE id = $1 AND is_active = true
      `,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    // prompt: "./"
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "https://irm.confideleap.com/login",
  }),
  async (req, res) => {
    try {
      const { email } = req.user;

      const result = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND is_active = true",
        [email]
      );

      if (result.rows.length === 0) {
        return res.redirect(
          "https://irm.confideleap.com/login?error=google_no_account"
        );
      }

      const userId = result.rows[0].id;

      const accessToken = generateAccessToken({ userId, email });
      const sessionToken = generateSessionToken();
      const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO user_sessions (user_id, session_token, expires_at)
         VALUES ($1,$2,$3)`,
        [userId, sessionToken, expiry]
      );

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("sessionToken", sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.redirect("https://irm.confideleap.com");
    } catch (error) {
      console.error(error);
      res.redirect("https://irm.confideleap.com/login");
    }
  }
);

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    // prompt: "./"
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "https://irm.confideleap.com/login",
  }),
  async (req, res) => {
    try {
      const { email } = req.user;

      const result = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND is_active = true",
        [email]
      );

      if (result.rows.length === 0) {
        return res.redirect(
          "https://irm.confideleap.com/login?error=google_no_account"
        );
      }

      const userId = result.rows[0].id;

      const accessToken = generateAccessToken({ userId, email });
      const sessionToken = generateSessionToken();
      const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO user_sessions (user_id, session_token, expires_at)
         VALUES ($1,$2,$3)`,
        [userId, sessionToken, expiry]
      );

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("sessionToken", sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.redirect("https://irm.confideleap.com");
    } catch (error) {
      console.error(error);
      res.redirect("https://irm.confideleap.com/login");
    }
  }
);

module.exports = router;
