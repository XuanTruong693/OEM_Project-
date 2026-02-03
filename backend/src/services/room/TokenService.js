/**
 * TokenService.js
 * Single Responsibility: JWT token generation and verification for room access
 * This service centralizes token logic previously duplicated in controllers.
 */

const jwt = require("jsonwebtoken");

class TokenService {
    constructor() {
        this.secret = process.env.JWT_SECRET || "dev_secret";
    }

    /**
     * Sign a short-lived room token
     * @param {Object} payload - Token payload (exam_id, room_code, etc.)
     * @param {number} ttlSeconds - Time to live in seconds (default 15 minutes)
     * @returns {string} JWT token
     */
    signRoomToken(payload, ttlSeconds = 15 * 60) {
        return jwt.sign(payload, this.secret, { expiresIn: ttlSeconds });
    }

    /**
     * Verify room token
     * @param {string} token - JWT token to verify
     * @returns {Object|null} Token claims or null if invalid
     */
    verifyRoomToken(token) {
        try {
            return jwt.verify(token, this.secret);
        } catch (e) {
            return null;
        }
    }

    /**
     * Sign a general purpose token
     * @param {Object} payload - Token payload
     * @param {string} expiresIn - Expiry (e.g., '1h', '7d')
     * @returns {string} JWT token
     */
    sign(payload, expiresIn = "1h") {
        return jwt.sign(payload, this.secret, { expiresIn });
    }

    /**
     * Verify a general purpose token
     * @param {string} token - JWT token to verify
     * @returns {Object|null} Token claims or null if invalid
     */
    verify(token) {
        try {
            return jwt.verify(token, this.secret);
        } catch (e) {
            return null;
        }
    }
}

// Export as singleton
const tokenService = new TokenService();

module.exports = {
    TokenService,
    tokenService,
    // Backward-compatible function exports
    signRoomToken: (payload, ttl) => tokenService.signRoomToken(payload, ttl),
    verifyRoomToken: (token) => tokenService.verifyRoomToken(token),
};
