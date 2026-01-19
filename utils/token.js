// api/utils/token.js
import jwt from "jsonwebtoken";
import crypto from "crypto";

export function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
}

export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}
