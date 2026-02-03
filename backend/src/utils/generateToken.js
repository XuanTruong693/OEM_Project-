const jwt = require("jsonwebtoken");
require("dotenv").config();

/**
 * Generate access token - Valid for 2 hours (enough for exam duration)
 * @param {object} payload - User data to encode
 * @param {string} clientIp - Optional client IP for logging
 */
function generateAccessToken(payload, clientIp = null) {
  const tokenPayload = { ...payload };
  if (clientIp) {
    tokenPayload.ip = clientIp; // Store IP for logging (not strict validation)
  }
  tokenPayload.iat = Math.floor(Date.now() / 1000);
  return jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "2h" });
}

function generateRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

module.exports = { generateAccessToken, generateRefreshToken };

