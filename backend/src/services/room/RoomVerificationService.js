/**
 * RoomVerificationService.js
 * Single Responsibility: Business logic for room verification
 * Extracted from controllers to follow SRP and allow easier testing.
 */

const sequelize = require("../../config/db");
const { signRoomToken } = require("./TokenService");

class RoomVerificationService {
    /**
     * Check if a column exists in a table
     * @param {string} table - Table name
     * @param {string} column - Column name
     * @returns {Promise<boolean>}
     */
    async hasColumn(table, column) {
        const [rows] = await sequelize.query(
            `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
            { replacements: [table, column] }
        );
        return Array.isArray(rows) && rows.length > 0;
    }

    /**
     * Find exam by room code
     * @param {string} roomCode - Room code to search for
     * @returns {Promise<Object|null>} Exam object or null
     */
    async findExamByRoomCode(roomCode) {
        const [rows] = await sequelize.query(
            `SELECT id, exam_room_code, status, duration 
       FROM exams 
       WHERE exam_room_code = ? AND status = 'published' 
       LIMIT 1`,
            { replacements: [roomCode] }
        );
        return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    }

    /**
     * Get exam settings (max_attempts, duration, etc.)
     * @param {number} examId - Exam ID
     * @returns {Promise<Object>}
     */
    async getExamSettings(examId) {
        const [rows] = await sequelize.query(
            `SELECT max_attempts, duration_minutes, duration, 
              time_open, time_close, require_face_check, 
              require_student_card, monitor_screen, max_points
       FROM exams 
       WHERE id = ? 
       LIMIT 1`,
            { replacements: [examId] }
        );
        return Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
    }

    /**
     * Count user's attempts for an exam
     * @param {number} examId - Exam ID
     * @param {number} userId - User ID
     * @returns {Promise<number>}
     */
    async countUserAttempts(examId, userId) {
        const [rows] = await sequelize.query(
            `SELECT COUNT(*) as attempt_count 
       FROM submissions 
       WHERE exam_id = ? AND user_id = ?`,
            { replacements: [examId, userId] }
        );
        return rows[0]?.attempt_count || 0;
    }

    /**
     * Check if user has exceeded max attempts
     * @param {number} examId - Exam ID
     * @param {number} userId - User ID
     * @param {number} maxAttempts - Maximum allowed attempts
     * @returns {Promise<{exceeded: boolean, current: number, max: number}>}
     */
    async checkMaxAttempts(examId, userId, maxAttempts) {
        if (!maxAttempts || maxAttempts <= 0) {
            return { exceeded: false, current: 0, max: 0 };
        }
        const current = await this.countUserAttempts(examId, userId);
        return {
            exceeded: current >= maxAttempts,
            current,
            max: maxAttempts,
        };
    }

    /**
     * Check time window for exam
     * @param {Date|string} timeOpen - Exam open time
     * @param {Date|string} timeClose - Exam close time
     * @returns {Promise<{valid: boolean, reason?: string, now?: string, time_open?: string, time_close?: string}>}
     */
    async checkTimeWindow(timeOpen, timeClose) {
        if (!timeOpen && !timeClose) {
            return { valid: true };
        }

        const tz = process.env.APP_TZ || "+07:00";
        const [checkRows] = await sequelize.query(
            `SELECT 
          CONVERT_TZ(NOW(), @@session.time_zone, ?) AS now_ts,
          ?                                        AS open_ts,
          ?                                        AS close_ts,
          (CASE WHEN ? IS NOT NULL AND CONVERT_TZ(NOW(), @@session.time_zone, ?) < ? THEN 1 ELSE 0 END) AS before_open,
          (CASE WHEN ? IS NOT NULL AND CONVERT_TZ(NOW(), @@session.time_zone, ?) > ? THEN 1 ELSE 0 END) AS after_close
       `,
            {
                replacements: [
                    tz,
                    timeOpen || null,
                    timeClose || null,
                    timeOpen || null,
                    tz,
                    timeOpen || null,
                    timeClose || null,
                    tz,
                    timeClose || null,
                ],
            }
        );

        const tw = Array.isArray(checkRows) ? checkRows[0] : checkRows;

        if (tw && Number(tw.before_open) === 1) {
            return {
                valid: false,
                reason: "before_open",
                message: "Chưa đến giờ mở phòng",
                now: tw.now_ts,
                time_open: tw.open_ts,
                time_close: tw.close_ts,
            };
        }

        if (tw && Number(tw.after_close) === 1) {
            return {
                valid: false,
                reason: "after_close",
                message: "Đã hết giờ làm bài",
                now: tw.now_ts,
                time_open: tw.open_ts,
                time_close: tw.close_ts,
            };
        }

        return { valid: true };
    }

    /**
     * Record user verified room
     * @param {number} userId - User ID
     * @param {string} roomCode - Room code
     */
    async recordVerifiedRoom(userId, roomCode) {
        try {
            await sequelize.query(
                `INSERT IGNORE INTO user_verified_rooms(user_id, exam_room_code, verified_at)
         VALUES (?, ?, NOW())`,
                { replacements: [userId, roomCode] }
            );
        } catch (e) {
            // Ignore if table doesn't exist
        }
    }

    /**
     * Create new submission for exam attempt
     * @param {number} examId - Exam ID
     * @param {number} userId - User ID
     * @returns {Promise<{submissionId: number, attemptNo: number}>}
     */
    async createSubmission(examId, userId) {
        // Get next attempt number
        const [maxAttempt] = await sequelize.query(
            `SELECT COALESCE(MAX(attempt_no), 0) AS max_attempt 
       FROM submissions 
       WHERE exam_id = ? AND user_id = ?`,
            { replacements: [examId, userId] }
        );

        const nextAttempt = (maxAttempt[0]?.max_attempt || 0) + 1;

        // Create submission
        const [ins] = await sequelize.query(
            `INSERT INTO submissions (exam_id, user_id, status, attempt_no, submitted_at, cheating_count) 
       VALUES (?, ?, 'pending', ?, NULL, 0)`,
            { replacements: [examId, userId, nextAttempt] }
        );

        return {
            submissionId: ins?.insertId || ins,
            attemptNo: nextAttempt,
        };
    }

    /**
     * Generate room token for verified room
     * @param {number} examId - Exam ID
     * @param {string} roomCode - Room code
     * @returns {string} JWT token
     */
    generateRoomToken(examId, roomCode) {
        return signRoomToken({ exam_id: examId, room_code: roomCode });
    }
}

// Export as singleton
const roomVerificationService = new RoomVerificationService();

module.exports = {
    RoomVerificationService,
    roomVerificationService,
};
