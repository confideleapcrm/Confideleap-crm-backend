// api/utils/token.js
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = {
  generateAccessToken,
  generateSessionToken,
  verifyAccessToken,
};
