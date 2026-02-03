/**
 * SubmissionRepository.js
 * Repository for submission-related database operations
 */

const BaseRepository = require("./BaseRepository");

class SubmissionRepository extends BaseRepository {
    constructor() {
        super("submissions");
    }

    /**
     * Find submission by ID and user
     * @param {number} submissionId - Submission ID
     * @param {number} userId - User ID
     * @returns {Promise<Object|null>}
     */
    async findByIdAndUser(submissionId, userId) {
        return this.findOne({ id: submissionId, user_id: userId });
    }

    /**
     * Count attempts for user in exam
     * @param {number} examId - Exam ID
     * @param {number} userId - User ID
     * @returns {Promise<number>}
     */
    async countAttempts(examId, userId) {
        return this.count({ exam_id: examId, user_id: userId });
    }

    /**
     * Get max attempt number for user in exam
     * @param {number} examId - Exam ID
     * @param {number} userId - User ID
     * @returns {Promise<number>}
     */
    async getMaxAttemptNo(examId, userId) {
        const rows = await this.query(
            `SELECT COALESCE(MAX(attempt_no), 0) AS max_attempt 
       FROM submissions WHERE exam_id = ? AND user_id = ?`,
            [examId, userId]
        );
        return rows[0]?.max_attempt || 0;
    }

    /**
     * Create new submission
     * @param {number} examId - Exam ID
     * @param {number} userId - User ID
     * @param {number} attemptNo - Attempt number
     * @returns {Promise<number>} Submission ID
     */
    async createSubmission(examId, userId, attemptNo) {
        return this.insert({
            exam_id: examId,
            user_id: userId,
            status: "pending",
            attempt_no: attemptNo,
            cheating_count: 0
        });
    }

    /**
     * Update submission status
     * @param {number} submissionId - Submission ID
     * @param {string} status - New status
     * @returns {Promise<boolean>}
     */
    async updateStatus(submissionId, status) {
        return this.updateById(submissionId, { status });
    }

    /**
     * Mark submission as started
     * @param {number} submissionId - Submission ID
     * @returns {Promise<boolean>}
     */
    async markStarted(submissionId) {
        await this.query(
            `UPDATE submissions SET status = 'in_progress', started_at = COALESCE(started_at, NOW()) WHERE id = ?`,
            [submissionId]
        );
        return true;
    }

    /**
     * Submit exam with score
     * @param {number} submissionId - Submission ID
     * @param {number} totalScore - Total score
     * @returns {Promise<boolean>}
     */
    async submitWithScore(submissionId, totalScore) {
        await this.query(
            `UPDATE submissions SET total_score = ?, suggested_total_score = total_score + COALESCE(ai_score,0), 
       status='graded', submitted_at = NOW() WHERE id = ?`,
            [totalScore, submissionId]
        );
        return true;
    }

    /**
     * Get submissions for exam with student info
     * @param {number} examId - Exam ID
     * @returns {Promise<Array>}
     */
    async findByExamWithStudent(examId) {
        return this.query(
            `SELECT s.*, u.full_name AS student_name, u.email AS student_email
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       WHERE s.exam_id = ?
       ORDER BY s.submitted_at DESC`,
            [examId]
        );
    }

    /**
     * Get user's results across all exams
     * @param {number} userId - User ID
     * @returns {Promise<Array>}
     */
    async findUserResults(userId) {
        return this.query(
            `SELECT s.id AS submission_id, s.exam_id, e.title AS exam_title,
              s.total_score AS mcq_score, s.ai_score AS essay_score,
              s.suggested_total_score, s.submitted_at, s.status
       FROM submissions s 
       JOIN exams e ON e.id = s.exam_id
       WHERE s.user_id = ? 
       ORDER BY s.submitted_at DESC`,
            [userId]
        );
    }

    /**
     * Update verification images
     * @param {number} submissionId - Submission ID
     * @param {Buffer} faceBlob - Face image blob
     * @param {string} faceMime - Face image mimetype
     * @param {Buffer} cardBlob - Card image blob
     * @param {string} cardMime - Card image mimetype
     * @returns {Promise<boolean>}
     */
    async updateImages(submissionId, faceBlob, faceMime, cardBlob, cardMime) {
        const updates = {};
        if (faceBlob) {
            updates.face_image_blob = faceBlob;
            updates.face_image_mimetype = faceMime;
        }
        if (cardBlob) {
            updates.student_card_blob = cardBlob;
            updates.student_card_mimetype = cardMime;
        }
        if (Object.keys(updates).length === 0) return false;
        return this.updateById(submissionId, updates);
    }
}

module.exports = new SubmissionRepository();
