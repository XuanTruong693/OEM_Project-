const jwt = require("jsonwebtoken");
require("dotenv").config();

function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "15m" });
}

function generateRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

module.exports = { generateAccessToken, generateRefreshToken };
