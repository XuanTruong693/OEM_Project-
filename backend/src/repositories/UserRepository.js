/**
 * UserRepository.js
 * Repository for user-related database operations
 */

const BaseRepository = require("./BaseRepository");

class UserRepository extends BaseRepository {
    constructor() {
        super("users");
    }

    /**
     * Find user by email
     * @param {string} email - User email
     * @returns {Promise<Object|null>}
     */
    async findByEmail(email) {
        return this.findOne({ email });
    }

    /**
     * Find user by ID with safe fields (no password)
     * @param {number} userId - User ID
     * @returns {Promise<Object|null>}
     */
    async findByIdSafe(userId) {
        return this.findById(userId, [
            "id", "full_name", "email", "role", "avatar",
            "gender", "address", "phone_number", "created_at"
        ]);
    }

    /**
     * Update user profile
     * @param {number} userId - User ID
     * @param {Object} data - Profile data
     * @returns {Promise<boolean>}
     */
    async updateProfile(userId, data) {
        const allowed = ["full_name", "gender", "address", "phone_number", "avatar"];
        const filtered = {};
        for (const key of allowed) {
            if (data[key] !== undefined) filtered[key] = data[key];
        }
        if (Object.keys(filtered).length === 0) return false;
        return this.updateById(userId, filtered);
    }

    /**
     * Update user avatar
     * @param {number} userId - User ID
     * @param {Buffer} blob - Avatar blob
     * @param {string} mimetype - Avatar mimetype
     * @returns {Promise<boolean>}
     */
    async updateAvatar(userId, blob, mimetype) {
        return this.updateById(userId, {
            avatar_blob: blob,
            avatar_mimetype: mimetype
        });
    }

    /**
     * Increment failed login attempts
     * @param {number} userId - User ID
     * @returns {Promise<boolean>}
     */
    async incrementFailedLogins(userId) {
        await this.query(
            `UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?`,
            [userId]
        );
        return true;
    }

    /**
     * Reset failed login attempts
     * @param {number} userId - User ID
     * @returns {Promise<boolean>}
     */
    async resetFailedLogins(userId) {
        return this.updateById(userId, { failed_login_attempts: 0 });
    }

    /**
     * Lock user account
     * @param {number} userId - User ID
     * @returns {Promise<boolean>}
     */
    async lockAccount(userId) {
        return this.updateById(userId, { is_locked: true });
    }

    /**
     * Unlock user account
     * @param {number} userId - User ID
     * @returns {Promise<boolean>}
     */
    async unlockAccount(userId) {
        return this.updateById(userId, { is_locked: false, failed_login_attempts: 0 });
    }

    /**
     * Get all users by role
     * @param {string} role - User role
     * @returns {Promise<Array>}
     */
    async findByRole(role) {
        return this.findAll({ role }, [
            "id", "full_name", "email", "role", "created_at", "is_locked"
        ], "created_at DESC");
    }
}

module.exports = new UserRepository();
