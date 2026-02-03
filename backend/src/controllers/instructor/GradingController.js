/**
 * GradingController.js
 * Single Responsibility: Handle grading and feedback operations for instructor
 * Extracted from instructorRoutes.js for SOLID compliance
 */

const sequelize = require("../../config/db");
const fs = require("fs");
const path = require("path");
const { ensureExamOwnership } = require("./ExamManagementController");
const { retryAllFailed } = require("../../services/AIService");

/**
 * GET /api/instructor/exams/:examId/submissions
 * Get all submissions for an exam
 */
async function getExamSubmissions(req, res) {
    try {
        const examId = parseInt(req.params.examId, 10);
        if (!Number.isFinite(examId)) {
            return res.status(400).json({ message: "examId invalid" });
        }

        const isOwner = await ensureExamOwnership(examId, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ message: "Access denied" });
        }

        const [rows] = await sequelize.query(
            `
      SELECT 
        s.id AS submission_id,
        s.user_id AS student_id,
        u.full_name AS student_name,
        u.email AS student_email,
        s.total_score,
        s.ai_score,
        s.suggested_total_score,
        s.status,
        s.started_at,
        s.submitted_at,
        TIMESTAMPDIFF(MINUTE, s.started_at, s.submitted_at) AS duration_minutes,
        s.cheating_count,
        s.attempt_no
      FROM submissions s
      JOIN users u ON u.id = s.user_id
      WHERE s.exam_id = ?
      ORDER BY s.submitted_at DESC
      `,
            { replacements: [examId] }
        );

        return res.json(rows);
    } catch (err) {
        console.error("getExamSubmissions error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

/**
 * GET /api/instructor/submissions/:submissionId/answers
 * Get detailed answers for a submission
 */
async function getSubmissionAnswers(req, res) {
    try {
        const submissionId = parseInt(req.params.submissionId, 10);
        if (!Number.isFinite(submissionId)) {
            return res.status(400).json({ message: "submissionId invalid" });
        }

        // Check ownership via exam
        const [[sub]] = await sequelize.query(
            `SELECT exam_id FROM submissions WHERE id = ?`,
            { replacements: [submissionId] }
        );

        if (!sub) {
            return res.status(404).json({ message: "Submission not found" });
        }

        const isOwner = await ensureExamOwnership(sub.exam_id, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ message: "Access denied" });
        }

        const [rows] = await sequelize.query(
            `
      SELECT 
        sa.id AS answer_id,
        sa.question_id,
        q.question_text,
        q.type,
        q.points AS max_points,
        q.model_answer,
        sa.answer_text AS student_answer,
        sa.selected_option_id,
        o.option_text AS selected_option_text,
        o.is_correct AS is_correct_option,
        sa.score,
        sa.ai_score,
        sa.ai_explanation,
        sa.instructor_feedback,
        sa.status AS answer_status
      FROM student_answers sa
      JOIN exam_questions q ON q.id = sa.question_id
      LEFT JOIN exam_options o ON o.id = sa.selected_option_id
      WHERE sa.submission_id = ?
      ORDER BY CASE WHEN q.type = 'MCQ' THEN 0 ELSE 1 END, COALESCE(q.order_index, 0) ASC, q.id ASC
      `,
            { replacements: [submissionId] }
        );

        return res.json(rows);
    } catch (err) {
        console.error("getSubmissionAnswers error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

/**
 * PUT /api/instructor/answers/:answerId/grade
 * Update grade for a specific answer
 */
async function gradeAnswer(req, res) {
    try {
        const answerId = parseInt(req.params.answerId, 10);
        if (!Number.isFinite(answerId)) {
            return res.status(400).json({ message: "answerId invalid" });
        }

        const { score, feedback } = req.body;

        // Check ownership
        const [[answer]] = await sequelize.query(
            `SELECT sa.submission_id, s.exam_id 
       FROM student_answers sa 
       JOIN submissions s ON s.id = sa.submission_id 
       WHERE sa.id = ?`,
            { replacements: [answerId] }
        );

        if (!answer) {
            return res.status(404).json({ message: "Answer not found" });
        }

        const isOwner = await ensureExamOwnership(answer.exam_id, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Update answer
        await sequelize.query(
            `UPDATE student_answers 
       SET score = ?, instructor_feedback = ?, status = 'graded', graded_at = NOW() 
       WHERE id = ?`,
            { replacements: [score, feedback || null, answerId] }
        );

        // Recalculate submission total
        await sequelize.query(
            `UPDATE submissions 
       SET total_score = (
         SELECT COALESCE(SUM(score), 0) FROM student_answers WHERE submission_id = ?
       )
       WHERE id = ?`,
            { replacements: [answer.submission_id, answer.submission_id] }
        );

        return res.json({
            message: "Answer graded successfully",
            answer_id: answerId,
            score,
        });
    } catch (err) {
        console.error("gradeAnswer error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

/**
 * POST /api/instructor/answers/:answerId/confirm-ai
 * Confirm AI score for an answer (used for learning)
 */
async function confirmAIScore(req, res) {
    try {
        const answerId = parseInt(req.params.answerId, 10);
        if (!Number.isFinite(answerId)) {
            return res.status(400).json({ message: "answerId invalid" });
        }

        // Check ownership
        const [[answer]] = await sequelize.query(
            `SELECT sa.*, s.exam_id 
       FROM student_answers sa 
       JOIN submissions s ON s.id = sa.submission_id 
       WHERE sa.id = ?`,
            { replacements: [answerId] }
        );

        if (!answer) {
            return res.status(404).json({ message: "Answer not found" });
        }

        const isOwner = await ensureExamOwnership(answer.exam_id, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Copy AI score to final score
        await sequelize.query(
            `UPDATE student_answers 
       SET score = ai_score, status = 'graded', graded_at = NOW() 
       WHERE id = ?`,
            { replacements: [answerId] }
        );

        return res.json({
            message: "AI score confirmed",
            answer_id: answerId,
            score: answer.ai_score,
        });
    } catch (err) {
        console.error("confirmAIScore error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

/**
 * POST /api/instructor/submissions/:submissionId/finalize
 * Finalize all grades for a submission
 */
async function finalizeSubmission(req, res) {
    try {
        const submissionId = parseInt(req.params.submissionId, 10);
        if (!Number.isFinite(submissionId)) {
            return res.status(400).json({ message: "submissionId invalid" });
        }

        // Check ownership
        const [[sub]] = await sequelize.query(
            `SELECT exam_id FROM submissions WHERE id = ?`,
            { replacements: [submissionId] }
        );

        if (!sub) {
            return res.status(404).json({ message: "Submission not found" });
        }

        const isOwner = await ensureExamOwnership(sub.exam_id, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Mark all pending answers as graded (using AI score if available)
        await sequelize.query(
            `UPDATE student_answers 
       SET score = COALESCE(score, ai_score, 0), status = 'graded', graded_at = NOW() 
       WHERE submission_id = ? AND status != 'graded'`,
            { replacements: [submissionId] }
        );

        // Update submission status
        await sequelize.query(
            `UPDATE submissions 
       SET status = 'graded', 
           total_score = (SELECT COALESCE(SUM(score), 0) FROM student_answers WHERE submission_id = ?)
       WHERE id = ?`,
            { replacements: [submissionId, submissionId] }
        );

        return res.json({
            message: "Submission finalized",
            submission_id: submissionId,
        });
    } catch (err) {
        console.error("finalizeSubmission error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

/**
 * POST /api/instructor/grading/retry-failed
 * Retry all failed AI grading jobs
 */
async function retryFailedGrading(req, res) {
    try {
        // Optional: specific to an exam? For now, retry all failed.
        // ownership check is not strictly needed if it's a global maintenance op, 
        // but ideally should be restricted or scoped. 
        // Since we don't have examId here easily without param, let's keep it global for instructor.

        const count = await retryAllFailed();
        return res.json({
            message: "Retry process initiated",
            reset_count: count
        });
    } catch (err) {
        console.error("retryFailedGrading error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

module.exports = {
    getExamSubmissions,
    getSubmissionAnswers,
    gradeAnswer,
    confirmAIScore,
    finalizeSubmission,
    retryFailedGrading,
    approveAllExamScores,
    updateStudentAnswerScore,
    updateStudentExamScore,
};

/**
 * POST /api/instructor/exams/:examId/approve-all-scores
 * Approve all submissions for an exam
 * RESTORED: Original inline logic from before refactoring
 */
async function approveAllExamScores(req, res) {
    try {
        const examId = parseInt(req.params.examId, 10);
        if (!Number.isFinite(examId))
            return res.status(400).json({ message: "examId invalid" });

        const ok = await ensureExamOwnership(examId, req.user.id);
        if (!ok) {
            return res.status(403).json({ message: "Not owner of exam" });
        }

        console.log(`📝 [ApproveAll] Starting bulk approval for exam ${examId}`);

        // Update all submissions: copy suggested_total_score to total_score, set instructor_confirmed=1
        const [result] = await sequelize.query(
            `UPDATE submissions 
             SET total_score = suggested_total_score,
                 instructor_confirmed = 1,
                 status = 'confirmed'
             WHERE exam_id = ? 
               AND instructor_confirmed = 0`,
            { replacements: [examId] }
        );

        const approvedCount = result.affectedRows || 0;
        console.log(
            `✅ [ApproveAll] Approved ${approvedCount} submissions for exam ${examId}`
        );

        return res.json({
            success: true,
            approved: approvedCount,
            message: `Đã duyệt ${approvedCount} bài thi`,
        });
    } catch (err) {
        console.error("❌ [ApproveAll] Error:", err);
        return res
            .status(500)
            .json({ message: "Server error", error: err.message });
    }
}

/**
 * PUT /api/instructor/submissions/:submissionId/answers/:answerId/score
 * Update score for a specific answer (Instructor manual edit)
 */
async function updateStudentAnswerScore(req, res) {
    try {
        const submissionId = parseInt(req.params.submissionId, 10);
        const answerId = parseInt(req.params.answerId, 10);
        const { score } = req.body;

        if (!Number.isFinite(submissionId) || !Number.isFinite(answerId)) {
            return res.status(400).json({ message: "Invalid IDs" });
        }

        // Check ownership
        const [[sub]] = await sequelize.query(
            `SELECT exam_id FROM submissions WHERE id = ?`,
            { replacements: [submissionId] }
        );

        if (!sub) return res.status(404).json({ message: "Submission not found" });

        const isOwner = await ensureExamOwnership(sub.exam_id, req.user.id);
        if (!isOwner) return res.status(403).json({ message: "Access denied" });

        // Check old score before update to trigger AI learning
        const [oldAnswer] = await sequelize.query(
            `SELECT sa.score, sa.answer_text, q.question_text, q.model_answer, q.points as max_points
             FROM student_answers sa
             JOIN exam_questions q ON sa.question_id = q.id
             WHERE sa.id = ? AND sa.submission_id = ?`,
            { replacements: [answerId, submissionId] }
        );

        const oldScore = Number(oldAnswer[0]?.score || 0);
        const scoreIncreased = score > oldScore;

        // Update answer score
        await sequelize.query(
            `UPDATE student_answers 
       SET score = ?, status = 'confirmed', graded_at = NOW()
       WHERE id = ? AND submission_id = ?`,
            { replacements: [score, answerId, submissionId] }
        );

        // TRIGGER AI LEARNING if score increased
        if (scoreIncreased && oldAnswer[0]) {
            try {
                // Async save to JSON (fire and forget to avoid blocking)
                saveToAiTrainingData({
                    question: oldAnswer[0].question_text,
                    model_answer: oldAnswer[0].model_answer,
                    student_answer: oldAnswer[0].answer_text,
                    score: score,
                    ai_score: oldScore,
                    max_points: oldAnswer[0].max_points,
                    category: "General",
                    feedback: "Corrected by Instructor (Score Increased)"
                }).catch(err => console.error("Video AI Training Data Save Error:", err));
            } catch (e) {
                console.error("Trigger AI Learning Error:", e);
            }
        }

        // Recalculate AI score (Essay) and Total Score
        // Get all answer scores
        const [answers] = await sequelize.query(
            `SELECT sa.score, q.type 
       FROM student_answers sa
       JOIN exam_questions q ON q.id = sa.question_id
       WHERE sa.submission_id = ?`,
            { replacements: [submissionId] }
        );

        let newTotal = 0;
        let newAiScore = 0;

        for (const a of answers) {
            const s = Number(a.score) || 0;
            newTotal += s;
            if (a.type !== 'MCQ') {
                newAiScore += s;
            }
        }

        // Recalculate distinct parts
        const [mcqResult] = await sequelize.query(
            `SELECT COALESCE(SUM(sa.score), 0) as mcq_sum 
             FROM student_answers sa 
             JOIN exam_questions q ON sa.question_id = q.id 
             WHERE sa.submission_id = ? AND q.type = 'MCQ'`,
            { replacements: [submissionId] }
        );
        const newMcqScore = Number(mcqResult[0]?.mcq_sum || 0);

        const [aiResult] = await sequelize.query(
            `SELECT COALESCE(SUM(sa.score), 0) as ai_sum
              FROM student_answers sa
              JOIN exam_questions q ON sa.question_id = q.id
              WHERE sa.submission_id = ? AND q.type != 'MCQ'`,
            { replacements: [submissionId] }
        );
        const newAiSum = Number(aiResult[0]?.ai_sum || 0);

        const newSuggestedTotal = newMcqScore + newAiSum;

        // Update submission: 
        // total_score = MCQ Score
        // ai_score = Essay Score
        // suggested_total_score = MCQ + Essay (Grand Total)
        await sequelize.query(
            `UPDATE submissions 
       SET total_score = ?, ai_score = ?, suggested_total_score = ?,
           instructor_confirmed = 1,
           status = 'confirmed'
       WHERE id = ?`,
            { replacements: [newMcqScore, newAiSum, newSuggestedTotal, submissionId] }
        );
        return res.json({
            success: true,
            message: "Score updated",
            new_ai_score: newAiSum,
            new_mcq_score: newMcqScore,
            new_grand_total: newSuggestedTotal,
            score_increased: scoreIncreased // ✅ Return flag for Frontend Toast
        });
    } catch (err) {
        console.error("updateStudentAnswerScore error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

/**
 * PUT /api/instructor/exams/:examId/students/:studentId/score
 * Update total score for a student in an exam
 */
/**
 * PUT /api/instructor/exams/:examId/students/:studentId/score
 * Update total score for a student in an exam (Save & Confirm)
 * Restored logic from submissionController.approveStudentScores
 */
async function updateStudentExamScore(req, res) {
    let transaction;
    try {
        const examId = parseInt(req.params.examId, 10);
        const studentId = parseInt(req.params.studentId, 10);
        const { mcq_score, ai_score, total_score, per_question_scores } = req.body;

        if (!Number.isFinite(examId) || !Number.isFinite(studentId)) {
            return res.status(400).json({ message: "Invalid IDs" });
        }

        const isOwner = await ensureExamOwnership(examId, req.user.id);
        if (!isOwner) return res.status(403).json({ message: "Access denied" });

        transaction = await sequelize.transaction();

        // 1. Call Stored Procedure to update submission record
        // SP signature: sp_update_student_exam_record(exam_id, user_id, submission_id, mcq_score, ai_score)
        // submissionController passed null for submission_id, so we do the same.
        await sequelize.query(
            "CALL sp_update_student_exam_record(:examId, :studentId, NULL, :mcqScore, :aiScore)",
            {
                replacements: {
                    examId,
                    studentId,
                    mcqScore: mcq_score || 0,
                    aiScore: ai_score || 0
                },
                transaction
            }
        );

        // 2. Update individual question scores (if provided)
        if (per_question_scores && Array.isArray(per_question_scores) && per_question_scores.length > 0) {
            for (const { question_id, score } of per_question_scores) {
                await sequelize.query(
                    `UPDATE student_answers sa
           JOIN submissions s ON sa.submission_id = s.id
           SET sa.score = :score, sa.status = 'confirmed', sa.graded_at = NOW()
           WHERE s.exam_id = :examId AND s.user_id = :studentId AND sa.question_id = :questionId`,
                    {
                        replacements: {
                            score,
                            examId,
                            studentId,
                            questionId: question_id
                        },
                        transaction
                    }
                );
            }
        }

        // 3. Ensure submission status is 'graded' and 'confirmed'
        // The SP likely updates scores, but we enforce status here to be sure
        await sequelize.query(
            `UPDATE submissions 
           SET instructor_confirmed = 1, status = 'graded', total_score = :totalScore
           WHERE exam_id = :examId AND user_id = :studentId`,
            {
                replacements: {
                    totalScore: total_score,
                    examId,
                    studentId
                },
                transaction
            }
        );

        await transaction.commit();
        return res.json({ success: true, message: "Student score updated successfully" });
    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error("updateStudentExamScore error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}


/**
 * Helper: Save corrected score to AI Training Data
 * 1. Saves to learned_data.json (File-based, immediate)
 * 2. Calls AI /learn/from-correction endpoint (Real-time hot-reload)
 */
async function saveToAiTrainingData(sample) {
    try {
        // 1. SAVE TO JSON FILE
        const filePath = path.resolve(__dirname, '../../../../ai_services/app/learned_data.json');
        console.log("📝 [AI Service] Saving to file:", filePath);

        // Ensure file exists
        if (!fs.existsSync(filePath)) {
            // Create new file with empty array
            await fs.promises.writeFile(filePath, '[]', 'utf8');
        }

        // Read and Parse
        const data = await fs.promises.readFile(filePath, 'utf8');
        let json;
        try {
            json = JSON.parse(data);
            if (!Array.isArray(json)) json = [];
        } catch (parseErr) {
            json = [];
        }

        // Add sample with proper schema
        const newRecord = {
            student_answer: sample.student_answer,
            model_answer: sample.model_answer,
            confirmed_score: Number(sample.score),
            max_points: Number(sample.max_points || 10),
            score_ratio: Number(sample.score) / Number(sample.max_points || 10),
            feedback: sample.feedback || `Instructor corrected: ${sample.ai_score} → ${sample.score}`,
            learned_at: new Date().toISOString()
        };
        json.push(newRecord);

        // Write back
        await fs.promises.writeFile(filePath, JSON.stringify(json, null, 2), 'utf8');
        console.log("✅ [AI Learning] Saved to learned_data.json");

        // 2. CALL AI HTTP ENDPOINT (for real-time hot-reload)
        try {
            const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
            await require('axios').post(`${AI_SERVICE_URL}/learn/from-correction`, {
                student_answer: sample.student_answer,
                model_answer: sample.model_answer,
                old_score: Number(sample.ai_score || 0),
                new_score: Number(sample.score),
                max_points: Number(sample.max_points || 10),
                feedback: sample.feedback || ''
            }, { timeout: 5000 });
            console.log("✅ [AI Learning] Called AI /learn/from-correction endpoint");
        } catch (httpErr) {
            // Non-critical - file save already succeeded
            console.warn("⚠️ [AI Learning] HTTP call failed (non-critical):", httpErr.message);
        }

    } catch (err) {
        console.error("❌ Failed to save to AI Learned Data:", err.message);
    }
}
