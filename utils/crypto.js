// api/utils/crypto.js
const crypto = require("crypto");

const ALGO = "aes-256-gcm";

/**
 * ENCRYPTION_KEY must be 32 bytes (base64 or raw). We will derive a 32-byte key via sha256 from the env var.
 */
function getKey() {
  const keySeed = process.env.ENCRYPTION_KEY || "";
  return crypto.createHash("sha256").update(String(keySeed)).digest();
}

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const cipherText = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // store iv + tag + cipher in base64
  return Buffer.concat([iv, tag, cipherText]).toString("base64");
}

function decrypt(b64) {
  if (!b64) return null;
  try {
    const data = Buffer.from(b64, "base64");
    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const cipherText = data.slice(28);
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(cipherText), decipher.final()]).toString("utf8");
    return plain;
  } catch (err) {
    console.error("Decrypt failed", err);
    return null;
  }
}

module.exports = { encrypt, decrypt };
