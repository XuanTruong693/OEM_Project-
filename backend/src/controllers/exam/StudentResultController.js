/**
 * StudentResultController.js
 * Single Responsibility: Handle student exam results and status queries
 * Extracted from studentExamController.js for SOLID compliance
 */

const sequelize = require("../../config/db");

// ============================================
// Controller Methods
// ============================================

/**
 * GET /api/results/my
 * Get current user's exam results
 */
async function myResults(req, res) {
    try {
        const userId = req.user.id;

        // Try view first
        try {
            const [rows] = await sequelize.query(
                `SELECT * FROM v_student_results WHERE student_id = ? ORDER BY submitted_at DESC`,
                { replacements: [userId] }
            );
            return res.json(rows);
        } catch (e) {
            // fallback
            const [rows] = await sequelize.query(
                `SELECT s.id AS submission_id, s.exam_id, e.title AS exam_title,
                s.total_score AS mcq_score, s.ai_score AS essay_score,
                s.suggested_total_score, s.submitted_at
         FROM submissions s JOIN exams e ON e.id = s.exam_id
         WHERE s.user_id = ? ORDER BY s.submitted_at DESC`,
                { replacements: [userId] }
            );
            return res.json(rows);
        }
    } catch (err) {
        console.error("myResults error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

/**
 * GET /api/exams/:id/public-info
 * Get public information about an exam
 */
async function getExamPublicInfo(req, res) {
    try {
        const examId = parseInt(req.params.id, 10);
        const [rows] = await sequelize.query(
            `SELECT e.id, e.title, e.duration, e.duration_minutes, e.time_open, e.time_close, e.max_points,
              e.require_face_check, e.require_student_card, e.monitor_screen,
              u.full_name AS instructor_name
       FROM exams e
       LEFT JOIN users u ON u.id = e.instructor_id
       WHERE e.id = ? AND e.status = 'published'
       LIMIT 1`,
            { replacements: [examId] }
        );
        const info = Array.isArray(rows) ? rows[0] : rows;
        if (!info)
            return res
                .status(404)
                .json({ message: "Exam not found or not published" });
        return res.json(info);
    } catch (err) {
        console.error("getExamPublicInfo error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

/**
 * GET /api/submissions/:id/status
 * Get verification status of a submission
 */
async function getSubmissionStatus(req, res) {
    try {
        const submissionId = req.params.id;
        const userId = req.user.id;

        // Kiểm tra submission tồn tại và thuộc về user
        const [rows] = await sequelize.query(
            `SELECT 
        id, exam_id, user_id, status,
        face_image_url, student_card_url,
        CASE WHEN face_image_blob IS NOT NULL OR face_image_url IS NOT NULL THEN TRUE ELSE FALSE END as face_verified,
        CASE WHEN student_card_blob IS NOT NULL OR student_card_url IS NOT NULL THEN TRUE ELSE FALSE END as card_verified
       FROM submissions 
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
            { replacements: [submissionId, userId] }
        );

        const submission = Array.isArray(rows) ? rows[0] : rows;
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }

        return res.json({
            submission_id: submission.id,
            exam_id: submission.exam_id,
            status: submission.status,
            face_image_url: submission.face_image_url,
            student_card_url: submission.student_card_url,
            face_verified: !!submission.face_verified,
            card_verified: !!submission.card_verified,
        });
    } catch (err) {
        console.error("getSubmissionStatus error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

module.exports = {
    myResults,
    getExamPublicInfo,
    getSubmissionStatus,
};
