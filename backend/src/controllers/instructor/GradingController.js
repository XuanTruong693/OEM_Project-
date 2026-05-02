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

        // Recalculate submission scores correctly (MCQ vs Essay separation)
        await sequelize.query(
            `UPDATE submissions s
             SET s.total_score = (
                 SELECT COALESCE(SUM(sa.score), 0) 
                 FROM student_answers sa 
                 JOIN exam_questions q ON q.id = sa.question_id 
                 WHERE sa.submission_id = s.id AND q.type = 'MCQ'
             ),
             s.ai_score = (
                 SELECT COALESCE(SUM(sa.score), 0) 
                 FROM student_answers sa 
                 JOIN exam_questions q ON q.id = sa.question_id 
                 WHERE sa.submission_id = s.id AND q.type = 'Essay'
             ),
             s.suggested_total_score = (
                 SELECT COALESCE(SUM(sa.score), 0) 
                 FROM student_answers sa 
                 WHERE sa.submission_id = s.id
             )
             WHERE s.id = ?`,
            { replacements: [answer.submission_id] }
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

        // Update submission status and recalculate all score parts
        await sequelize.query(
            `UPDATE submissions s
             SET s.status = 'graded',
                 s.total_score = (
                     SELECT COALESCE(SUM(sa.score), 0) 
                     FROM student_answers sa 
                     JOIN exam_questions q ON q.id = sa.question_id 
                     WHERE sa.submission_id = s.id AND q.type = 'MCQ'
                 ),
                 s.ai_score = (
                     SELECT COALESCE(SUM(sa.score), 0) 
                     FROM student_answers sa 
                     JOIN exam_questions q ON q.id = sa.question_id 
                     WHERE sa.submission_id = s.id AND q.type = 'Essay'
                 ),
                 s.suggested_total_score = (
                     SELECT COALESCE(SUM(sa.score), 0) 
                     FROM student_answers sa 
                     WHERE sa.submission_id = s.id
                 )
             WHERE s.id = ?`,
            { replacements: [submissionId] }
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
        const [result] = await sequelize.query(
            `UPDATE submissions 
             SET instructor_confirmed = 1,
                 status = 'confirmed'
             WHERE exam_id = ? 
               AND instructor_confirmed = 0`,
            { replacements: [examId] }
        );

        const approvedCount = result.affectedRows || 0;

        // Đồng bộ bảng results: Trigger trg_confirmed_results_update chỉ fire khi 
        // status = 'graded', nhưng ở đây ta set thẳng 'confirmed', nên phải sync thủ công.
        if (approvedCount > 0) {
            await sequelize.query(
                `INSERT INTO results (exam_id, student_id, total_score, status)
                 SELECT s.exam_id, s.user_id, COALESCE(s.suggested_total_score, s.total_score), 'confirmed'
                 FROM submissions s
                 WHERE s.exam_id = ? AND s.instructor_confirmed = 1
                 ON DUPLICATE KEY UPDATE 
                    total_score = VALUES(total_score),
                    status = 'confirmed'`,
                { replacements: [examId] }
            );
            console.log(`✅ [ApproveAll] Synced results table for exam ${examId}`);
        }

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
        const { score, feedback: correctionFeedback } = req.body;

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

        // Get original AI suggestions from logs for comparison
        const [oldAnswer] = await sequelize.query(
            `SELECT sa.answer_text, q.question_text, q.model_answer, q.points as max_points,
                    (SELECT ai_suggested_score FROM ai_logs 
                     WHERE question_id = sa.question_id AND student_id = sa.student_id 
                     ORDER BY created_at DESC LIMIT 1) as ai_suggested_score
             FROM student_answers sa
             JOIN exam_questions q ON sa.question_id = q.id
             WHERE sa.id = ? AND sa.submission_id = ?`,
            { replacements: [answerId, submissionId] }
        );

        const aiSuggestedScore = Number(oldAnswer[0]?.ai_suggested_score ?? 0);
        // Only trigger learning if the instructor actually CHANGED the AI's recommendation
        const scoreCorrected = Math.abs(score - aiSuggestedScore) > 0.05;
        let aiLearned = false;

        // Update answer score
        await sequelize.query(
            `UPDATE student_answers 
       SET score = ?, instructor_feedback = ?, status = 'confirmed', graded_at = NOW()
       WHERE id = ? AND submission_id = ?`,
            { replacements: [score, correctionFeedback || null, answerId, submissionId] }
        );

        // TRIGGER AI LEARNING if score was corrected (up or down)
        if (scoreCorrected && oldAnswer[0]) {
            try {
                // Async save to JSON (fire and forget to avoid blocking)
                saveToAiTrainingData({
                    question: oldAnswer[0].question_text,
                    model_answer: oldAnswer[0].model_answer,
                    student_answer: oldAnswer[0].answer_text,
                    score: score,
                    ai_score: aiSuggestedScore,
                    max_points: oldAnswer[0].max_points,
                    category: "General",
                    feedback: correctionFeedback || `Instructor corrected: ${aiSuggestedScore} → ${score}`
                }).catch(err => console.error("⚠️ [AI Learning] Save Error:", err));
                aiLearned = true;
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
            score_increased: score > aiSuggestedScore, // Keep for legacy UI toasts
            score_changed: scoreCorrected,
            ai_learned: aiLearned, // ✅ Return flag for ML learning indicator
            old_ai_score: aiSuggestedScore // ✅ Return old score for comparison
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
async function updateStudentExamScore(req, res) {
    let transaction;
    try {
        const examId = parseInt(req.params.examId, 10);
        const studentId = parseInt(req.params.studentId, 10);
        const { mcq_score, ai_score, total_score, per_question_scores, submission_id } = req.body;

        if (!Number.isFinite(examId) || !Number.isFinite(studentId)) {
            return res.status(400).json({ message: "Invalid IDs" });
        }

        const isOwner = await ensureExamOwnership(examId, req.user.id);
        if (!isOwner) return res.status(403).json({ message: "Access denied" });

        transaction = await sequelize.transaction();

        // 1. Call Stored Procedure to update submission record
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
            for (const { answer_id, score, feedback } of per_question_scores) {
                await sequelize.query(
                    `UPDATE student_answers 
                     SET score = :score, instructor_feedback = :feedback, status = 'confirmed', graded_at = NOW()
                     WHERE id = :answerId AND submission_id = :submissionId`,
                    {
                        replacements: {
                            score,
                            feedback: feedback || null,
                            submissionId: submission_id || 0,
                            answerId: answer_id
                        },
                        transaction
                    }
                );
            }
        }

        // 3. Update the submission summary using legacy mapping
        const mcqPart = Number(mcq_score || 0);
        const essayPart = Number(ai_score || 0);
        const absoluteTotal = mcqPart + essayPart;

        await sequelize.query(
            `UPDATE submissions 
             SET instructor_confirmed = 1, 
                 status = 'graded', 
                 total_score = :mcqPart, 
                 ai_score = :essayPart, 
                 suggested_total_score = :totalSum, 
                 updated_at = NOW()
             WHERE id = :submissionId`,
            {
                replacements: {
                    mcqPart,
                    essayPart,
                    totalSum: absoluteTotal,
                    submissionId: submission_id
                },
                transaction
            }
        );

        await transaction.commit();

        // 4. TRIGGER BATCH AI LEARNING (if per_question_scores provided)
        if (per_question_scores && Array.isArray(per_question_scores)) {
            try {
                const samples = [];
                for (const item of per_question_scores) {
                    // Find matching question details from db using the answer_id
                    const [qDetail] = await sequelize.query(
                        `SELECT sa.answer_text, sa.score as current_score, q.question_text, q.model_answer, q.points as max_points
                         FROM student_answers sa
                         JOIN exam_questions q ON q.id = sa.question_id
                         WHERE sa.id = ? AND sa.submission_id = ?`,
                        { replacements: [item.answer_id, submission_id] }
                    );

                    if (qDetail && qDetail[0]) {
                        const old_score = Number(qDetail[0].current_score || 0);
                        const new_score = Number(item.score);

                        // GUARD: Only learn if score was actually changed
                        if (Math.abs(new_score - old_score) > 0.05) {
                            samples.push({
                                student_answer: qDetail[0].answer_text,
                                model_answer: qDetail[0].model_answer,
                                old_score: old_score,
                                new_score: new_score,
                                max_points: Number(qDetail[0].max_points || 10),
                                feedback: item.feedback || `Bulk Instructor correction`
                            });

                            // Also append to local file for consistency
                            saveToAiTrainingData({
                                question: qDetail[0].question_text,
                                model_answer: qDetail[0].model_answer,
                                student_answer: qDetail[0].answer_text,
                                score: item.score,
                                ai_score: old_score,
                                max_points: qDetail[0].max_points,
                                feedback: item.feedback || ''
                            }).catch(e => { });
                        } else {
                            console.log(`⏭️ [AI Learning] Skipped answer ${item.answer_id} (no change: ${old_score} == ${new_score})`);
                        }
                    }
                }

                if (samples.length > 0) {
                    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
                    const axios = require('axios');
                    axios.post(`${AI_SERVICE_URL}/learn/batch-train`, { samples, trigger_retrain: true })
                        .then(() => console.log(`✅ [AI Learning] Batch trained ${samples.length} samples`))
                        .catch(e => console.error("⚠️ [AI Learning] Batch train failed:", e.message));
                }
            } catch (learningErr) {
                console.error("⚠️ [AI Learning] Post-transaction learning trigger failed:", learningErr);
            }
        }

        // 5. Fetch and return the updated row for UI sync
        const [updatedRows] = await sequelize.query(
            `SELECT s.id as submission_id, s.user_id as student_id, u.full_name as student_name,
                    s.total_score, s.ai_score, s.suggested_total_score, s.status, s.instructor_confirmed
             FROM submissions s
             JOIN users u ON u.id = s.user_id
             WHERE s.id = ?`,
            { replacements: [submission_id] }
        );

        return res.json(updatedRows[0] || { success: true });
    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error("updateStudentExamScore error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

/**
 * Helper: Save corrected score to AI Training Data
 */
async function saveToAiTrainingData(sample) {
    try {
        const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        await require('axios').post(`${AI_SERVICE_URL}/learn/from-correction`, {
            student_answer: sample.student_answer,
            model_answer: sample.model_answer,
            old_score: Number(sample.ai_score || 0),
            new_score: Number(sample.score),
            max_points: Number(sample.max_points || 10),
            feedback: sample.feedback || ''
        }, { timeout: 30000 });

        console.log("✅ [AI Learning] Successfully notified AI service of correction");
    } catch (err) {
        console.error("⚠️ [AI Learning] Notification failed:", err.message);
    }
}
