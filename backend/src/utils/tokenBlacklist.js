// Set of blacklisted token JTI (JWT ID) or full tokens
const blacklistedTokens = new Set();

// Map of token -> expiry time for auto-cleanup
const tokenExpiry = new Map();

/**
 * Add a token to the blacklist
 * @param {string} token - The JWT token to blacklist
 * @param {number} expiresAt - Unix timestamp when token expires (for cleanup)
 */
function addToBlacklist(token, expiresAt) {
    if (!token) return;

    blacklistedTokens.add(token);

    // Store expiry time for cleanup
    if (expiresAt) {
        tokenExpiry.set(token, expiresAt);
    } else {
        // Default: remove after 2 hours if no expiry provided
        tokenExpiry.set(token, Date.now() + 2 * 60 * 60 * 1000);
    }

    console.log(`🔒 [Blacklist] Token added. Total blacklisted: ${blacklistedTokens.size}`);
}

/**
 * Check if a token is blacklisted
 * @param {string} token - The JWT token to check
 * @returns {boolean} True if token is blacklisted
 */
function isBlacklisted(token) {
    return blacklistedTokens.has(token);
}

/**
 * Remove a specific token from blacklist
 * @param {string} token - The token to remove
 */
function removeFromBlacklist(token) {
    blacklistedTokens.delete(token);
    tokenExpiry.delete(token);
}

function cleanupExpiredTokens() {
    const now = Date.now();
    let cleaned = 0;

    for (const [token, expiry] of tokenExpiry.entries()) {
        if (expiry < now) {
            blacklistedTokens.delete(token);
            tokenExpiry.delete(token);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`🧹 [Blacklist] Cleaned up ${cleaned} expired tokens. Remaining: ${blacklistedTokens.size}`);
    }
}

/**
 * Get blacklist statistics
 * @returns {object} Stats about the blacklist
 */
function getStats() {
    return {
        totalBlacklisted: blacklistedTokens.size,
        oldestExpiry: Math.min(...tokenExpiry.values()) || null,
    };
}

// Auto-cleanup every 30 minutes
setInterval(cleanupExpiredTokens, 30 * 60 * 1000);

module.exports = {
    addToBlacklist,
    isBlacklisted,
    removeFromBlacklist,
    cleanupExpiredTokens,
    getStats,
};
