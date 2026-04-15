
const sequelize = require("../../config/db");

// Controller Methods

async function myResults(req, res) {
    try {
        const userId = req.user.id;

        // Try view first (with all required columns)
        try {
            const [rows] = await sequelize.query(
                `SELECT 
                    submission_id, exam_id, exam_title,
                    mcq_score, essay_score, suggested_total_score,
                    display_score, score_status, status, submitted_at, duration,
                    allow_view_answers
                 FROM v_student_results 
                 WHERE student_id = ? 
                 ORDER BY submitted_at DESC`,
                { replacements: [userId] }
            );
            return res.json(rows);
        } catch (e) {
            // fallback if view doesn't exist or has different structure
            const [rows] = await sequelize.query(
                `SELECT s.id AS submission_id, s.exam_id, e.title AS exam_title,
                    s.total_score AS mcq_score, s.ai_score AS essay_score,
                    s.suggested_total_score, s.status, s.submitted_at,
                    e.allow_view_answers
                 FROM submissions s 
                 JOIN exams e ON e.id = s.exam_id
                 WHERE s.user_id = ? 
                 ORDER BY s.submitted_at DESC`,
                { replacements: [userId] }
            );
            return res.json(rows);
        }
    } catch (err) {
        console.error("myResults error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

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

async function getSubmissionStatus(req, res) {
    try {
        const submissionId = req.params.id;
        const userId = req.user.id;

        // Kiểm tra submission tồn tại và thuộc về user
        const [rows] = await sequelize.query(
            `SELECT 
        s.id, s.exam_id, s.user_id, s.status, s.submitted_at,
        s.face_image_url, s.student_card_url,
        CASE WHEN s.face_image_blob IS NOT NULL OR s.face_image_url IS NOT NULL THEN TRUE ELSE FALSE END as face_verified,
        CASE WHEN s.student_card_blob IS NOT NULL OR s.student_card_url IS NOT NULL THEN TRUE ELSE FALSE END as card_verified,
        (SELECT COUNT(*) FROM cheating_logs cl WHERE cl.submission_id = s.id AND cl.event_type = 'admin_bypass') > 0 as is_bypassed
       FROM submissions s
       WHERE s.id = ? AND s.user_id = ?
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
            submitted_at: submission.submitted_at,
            face_image_url: submission.face_image_url,
            student_card_url: submission.student_card_url,
            face_verified: !!submission.face_verified,
            card_verified: !!submission.card_verified,
            is_bypassed: !!submission.is_bypassed,
        });
    } catch (err) {
        console.error("getSubmissionStatus error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

async function getSubmissionDetail(req, res) {
    try {
        const submissionId = req.params.id;
        const userId = req.user.id;

        const [subRows] = await sequelize.query(
            `SELECT s.id, s.exam_id, e.allow_view_answers, e.title as exam_title
             FROM submissions s
             JOIN exams e ON e.id = s.exam_id
             WHERE s.id = ? AND s.user_id = ?
             LIMIT 1`,
            { replacements: [submissionId, userId] }
        );

        const sub = subRows?.[0];
        if (!sub) return res.status(404).json({ message: "Không tìm thấy bài làm." });
        if (!sub.allow_view_answers) return res.status(403).json({ message: "Giảng viên chưa cho phép xem đáp án." });

        // 2. Lấy câu hỏi, options và câu trả lời của sinh viên
        const [questions] = await sequelize.query(
            `SELECT id as question_id, question_text, type, points, order_index, model_answer 
             FROM exam_questions 
             WHERE exam_id = ? 
             ORDER BY CASE WHEN type = 'MCQ' THEN 0 ELSE 1 END, COALESCE(order_index, 0) ASC, id ASC`,
            { replacements: [sub.exam_id] }
        );

        const [options] = await sequelize.query(
            `SELECT eo.id as option_id, eo.question_id, eo.option_text, eo.is_correct
             FROM exam_options eo
             JOIN exam_questions eq ON eo.question_id = eq.id
             WHERE eq.exam_id = ?`,
            { replacements: [sub.exam_id] }
        );

        const [answers] = await sequelize.query(
            `SELECT question_id, answer_text, selected_option_id, score, instructor_feedback
             FROM student_answers
             WHERE submission_id = ? AND student_id = ?`,
            { replacements: [submissionId, userId] }
        );

        res.json({
            exam_title: sub.exam_title,
            questions,
            options,
            answers
        });
    } catch (err) {
        console.error("getSubmissionDetail error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

module.exports = {
    myResults,
    getExamPublicInfo,
    getSubmissionStatus,
    getSubmissionDetail,
};
