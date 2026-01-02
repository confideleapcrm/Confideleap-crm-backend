// api/routes/googleAuth.js
const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const router = express.Router();
const cookie = require("cookie");

// PostgreSQL client
const db = require("../database/database");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "http://localhost:3001/api/googleAuth/callback";

const oauth2Client = new OAuth2Client(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// =======================================================
// Helper: base64 encode/decode state JSON
// =======================================================
function encodeState(obj) {
  try {
    const json = JSON.stringify(obj || {});
    return Buffer.from(json, "utf8").toString("base64");
  } catch {
    return "";
  }
}

function decodeState(str) {
  try {
    const json = Buffer.from(String(str || ""), "base64").toString("utf8");
    return JSON.parse(json || "{}");
  } catch {
    return null;
  }
}

// =======================================================
// GET /api/googleAuth/connect?userId=...
// =======================================================
router.get("/connect", async (req, res) => {
  try {
    const userId = req.query.userId || null;

    const scopes = [
      "https://www.googleapis.com/auth/calendar.events",
      "openid",
      "email",
      "profile",
    ];

    const stateObj = {};
    if (userId) stateObj.userId = String(userId);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: scopes,
      state: encodeState(stateObj),
    });

    // Cookie fallback (5 minutes)
    if (userId) {
      res.cookie("google_connect_user", String(userId), {
        maxAge: 5 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
    }

    return res.redirect(authUrl);
  } catch (err) {
    console.error("googleAuth.connect error", err);
    return res
      .status(500)
      .json({ error: "google_connect_failed", detail: String(err) });
  }
});

// =======================================================
// GET /api/googleAuth/callback?code=...&state=...
// =======================================================
router.get("/callback", async (req, res) => {
  try {
    console.log("googleAuth callback hit", { query: req.query });

    const code = req.query.code;
    const stateRaw = req.query.state;

    let state = null;
    try {
      state = stateRaw ? decodeState(String(stateRaw)) : null;
    } catch {
      state = null;
    }

    const userIdFromState = state?.userId || null;
    const userIdFromQuery = req.query.userId || null;
    const userIdFromCookie =
      req.cookies?.google_connect_user || null;

    const effectiveUserId =
      (req.user && req.user.id) ||
      userIdFromState ||
      userIdFromQuery ||
      userIdFromCookie ||
      null;

    if (!code) {
      return res.status(400).send("Missing code");
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(String(code));
    const refreshToken = tokens.refresh_token || null;

    if (!effectiveUserId) {
      console.warn(
        "No userId available to store Google token - state/userId missing"
      );
      return res
        .status(200)
        .send("Google connected - please return to the app to complete setup.");
    }

    // Build update fields
    const updateFields = [];
    const values = [];
    let i = 0;

    if (refreshToken) {
      updateFields.push(`google_refresh_token = $${++i}`);
      values.push(refreshToken);
    }

    if (tokens.access_token) {
      updateFields.push(`last_google_access_token = $${++i}`);
      values.push(tokens.access_token);
    }

    if (tokens.expiry_date) {
      updateFields.push(`google_token_expires_at = $${++i}`);
      values.push(new Date(tokens.expiry_date));
    }

    if (updateFields.length > 0) {
      updateFields.push(`updated_at = NOW()`);

      await db.query(
        `
        UPDATE users
        SET ${updateFields.join(", ")}
        WHERE id = $${++i}
        `,
        [...values, effectiveUserId]
      );
    }

    // Clear cookie
    try {
      res.clearCookie("google_connect_user", { path: "/" });
    } catch {}

    const returnUrl =
      process.env.GOOGLE_AFTER_CONNECT_URL ||
      "http://localhost:5173/settings";

    return res.redirect(returnUrl);
  } catch (err) {
    console.error("googleAuth.callback error", err);
    return res.status(500).send("Google callback failed: " + String(err));
  }
});

module.exports = router;

