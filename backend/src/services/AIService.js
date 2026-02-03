const axios = require("axios");
const { pool } = require("../config/db");

// Configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const MAX_CONCURRENT_JOBS = 16; // Optimized for balance of speed and memory
const GRADING_TIMEOUT = 45000; // 45 seconds per AI request
const MAX_RETRIES = 5; // Increased for reliability
const RETRY_DELAY_BASE = 2000; // 2 second base delay
const RECOVERY_INTERVAL = 30000; // Check for pending/failed every 30s
const STALE_TIMEOUT = 300000; // 5 minutes - mark as stale if in_progress too long

// Job tracking
let activeJobs = 0;
let recoveryInterval = null;
let isRecovering = false;

/**
 * Initialize the AI grading service with recovery
 */
const initialize = () => {
    console.log("[AIService] 🚀 Initializing AI Grading Service...");
    console.log(`[AIService] ⚙️ Config: MAX_CONCURRENT=${MAX_CONCURRENT_JOBS}, TIMEOUT=${GRADING_TIMEOUT}ms, MAX_RETRIES=${MAX_RETRIES}`);

    // Run recovery on startup
    setTimeout(() => {
        console.log("[AIService] 🔍 Running startup recovery check...");
        recoverPendingSubmissions();
    }, 5000); // Wait 5s for DB connection to stabilize

    // Start background recovery worker
    recoveryInterval = setInterval(() => {
        if (!isRecovering) {
            recoverPendingSubmissions();
        }
    }, RECOVERY_INTERVAL);

    console.log("[AIService] ✅ Background recovery worker started (every 30s)");
};

/**
 * Add a submission to grading queue with database tracking
 * @param {number} submissionId 
 */
const gradeSubmission = async (submissionId) => {
    let conn;
    try {
        conn = await pool.getConnection();

        // Check if submission has essay questions
        const [essays] = await conn.query(`
            SELECT COUNT(*) as count FROM student_answers sa
            JOIN exam_questions q ON q.id = sa.question_id
            WHERE sa.submission_id = ? AND q.type = 'Essay' AND sa.answer_text IS NOT NULL
        `, [submissionId]);

        if (!essays[0] || essays[0].count === 0) {
            // No essays - mark as not required
            await conn.query(`
                UPDATE submissions 
                SET ai_grading_status = 'not_required'
                WHERE id = ?
            `, [submissionId]);
            console.log(`[AIService] ℹ️ Submission ${submissionId}: No essays, skipped`);
            return;
        }

        // Mark as pending in database
        await conn.query(`
            UPDATE submissions 
            SET ai_grading_status = 'pending', 
                ai_grading_retry_count = 0,
                ai_grading_error = NULL
            WHERE id = ?
        `, [submissionId]);

        console.log(`[AIService] 📥 Queued submission ${submissionId} (${essays[0].count} essays)`);

        // Process immediately if capacity available
        processSubmission(submissionId);

    } catch (err) {
        console.error(`[AIService] ❌ Error queuing submission ${submissionId}:`, err.message);
    } finally {
        if (conn) conn.release();
    }
};

/**
 * Process a single submission
 */
const processSubmission = async (submissionId) => {
    if (activeJobs >= MAX_CONCURRENT_JOBS) {
        console.log(`[AIService] ⏳ Queue full (${activeJobs}/${MAX_CONCURRENT_JOBS}), submission ${submissionId} will be picked up by recovery`);
        return;
    }

    activeJobs++;
    let conn;

    try {
        conn = await pool.getConnection();

        // Mark as in_progress with timestamp
        await conn.query(`
            UPDATE submissions 
            SET ai_grading_status = 'in_progress',
                ai_grading_started_at = NOW()
            WHERE id = ? AND ai_grading_status IN ('pending', 'failed')
        `, [submissionId]);

        console.log(`[AIService] 🚀 Processing submission ${submissionId}. Active: ${activeJobs}/${MAX_CONCURRENT_JOBS}`);

        // Perform grading
        await performGrading(submissionId, conn);

        // Mark as completed
        await conn.query(`
            UPDATE submissions 
            SET ai_grading_status = 'completed',
                ai_grading_error = NULL
            WHERE id = ?
        `, [submissionId]);

        console.log(`[AIService] ✅ Completed submission ${submissionId}`);

    } catch (err) {
        console.error(`[AIService] ❌ Failed submission ${submissionId}:`, err.message);

        // Mark as failed with error
        try {
            if (conn) {
                await conn.query(`
                    UPDATE submissions 
                    SET ai_grading_status = 'failed',
                        ai_grading_retry_count = ai_grading_retry_count + 1,
                        ai_grading_error = ?
                    WHERE id = ?
                `, [err.message.substring(0, 500), submissionId]);
            }
        } catch (dbErr) {
            console.error(`[AIService] DB error updating failed status:`, dbErr.message);
        }
    } finally {
        activeJobs--;
        if (conn) conn.release();
    }
};

/**
 * Core grading logic
 */
const performGrading = async (submissionId, conn) => {
    const startTime = Date.now();

    // Fetch Essay Answers
    const [answers] = await conn.query(`
        SELECT sa.id, sa.answer_text, sa.question_id, sa.student_id,
               q.model_answer, q.points AS max_points
        FROM student_answers sa
        JOIN exam_questions q ON sa.question_id = q.id
        WHERE sa.submission_id = ? AND q.type = 'Essay'
    `, [submissionId]);

    if (!answers || answers.length === 0) {
        return;
    }

    let totalAIScore = 0;
    let gradedCount = 0;
    let failedCount = 0;

    // Grade each answer
    for (const ans of answers) {
        if (!ans.answer_text || ans.answer_text.trim() === "") {
            continue;
        }

        const aiResult = await callAIService(ans.answer_text, ans.model_answer, ans.max_points);

        if (aiResult) {
            const { score, confidence } = aiResult;

            // Update student_answer
            await conn.query(`
                UPDATE student_answers 
                SET score = ?, status = 'graded', graded_at = NOW()
                WHERE id = ?
            `, [score, ans.id]);

            // Log to ai_logs
            await conn.query(`
                INSERT INTO ai_logs (question_id, student_id, student_answer, model_answer, similarity_score, ai_suggested_score, request_payload, response_payload)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                ans.question_id,
                ans.student_id,
                ans.answer_text,
                ans.model_answer,
                confidence,
                score,
                JSON.stringify({ student: ans.answer_text.substring(0, 200), model: ans.model_answer?.substring(0, 200) }),
                JSON.stringify(aiResult)
            ]);

            totalAIScore += score;
            gradedCount++;
        } else {
            failedCount++;
        }
    }

    // Update Submission totals
    await conn.query(`
        UPDATE submissions 
        SET ai_score = ?, 
            suggested_total_score = total_score + ?
        WHERE id = ?
    `, [totalAIScore, totalAIScore, submissionId]);

    const elapsed = Date.now() - startTime;
    console.log(`[AIService] 📊 Submission ${submissionId}: Score=${totalAIScore}, Graded=${gradedCount}/${answers.length}, Time=${elapsed}ms`);

    if (failedCount > 0) {
        throw new Error(`${failedCount} essays failed to grade`);
    }
};

/**
 * Call AI Service with retry and timeout
 */
const callAIService = async (studentAnswer, modelAnswer, maxPoints, retryCount = 0) => {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/grade`, {
            student_answer: studentAnswer,
            model_answer: modelAnswer,
            max_points: maxPoints
        }, {
            timeout: GRADING_TIMEOUT,
            headers: { 'Content-Type': 'application/json' }
        });

        return response.data;
    } catch (err) {
        const isRetryable = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'].includes(err.code)
            || err.response?.status === 429
            || err.response?.status >= 500;

        if (retryCount < MAX_RETRIES && isRetryable) {
            const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
            console.log(`[AIService] 🔄 Retry ${retryCount + 1}/${MAX_RETRIES} after ${delay}ms`);
            await new Promise(r => setTimeout(r, delay));
            return callAIService(studentAnswer, modelAnswer, maxPoints, retryCount + 1);
        }

        if (err.code === 'ECONNREFUSED') {
            console.error(`[AIService] 🔌 AI Service not available at ${AI_SERVICE_URL}`);
        }

        return null;
    }
};
const recoverPendingSubmissions = async () => {
    if (isRecovering) return;
    isRecovering = true;

    let conn;
    try {
        conn = await pool.getConnection();
        const [pending] = await conn.query(`
            SELECT id, ai_grading_status, ai_grading_retry_count
            FROM submissions
            WHERE ai_grading_status = 'pending'
               OR (ai_grading_status = 'failed' AND ai_grading_retry_count < ?)
               OR (ai_grading_status = 'in_progress' AND ai_grading_started_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE))
            ORDER BY id ASC
            LIMIT 50
        `, [MAX_RETRIES]);

        if (pending && pending.length > 0) {
            console.log(`[AIService] 🔍 Recovery found ${pending.length} submissions to process`);

            for (const sub of pending) {
                if (activeJobs < MAX_CONCURRENT_JOBS) {
                    // Reset stale in_progress to pending
                    if (sub.ai_grading_status === 'in_progress') {
                        await conn.query(`
                            UPDATE submissions 
                            SET ai_grading_status = 'pending'
                            WHERE id = ?
                        `, [sub.id]);
                    }

                    processSubmission(sub.id);

                    // Small delay between starting jobs
                    await new Promise(r => setTimeout(r, 100));
                }
            }
        }

    } catch (err) {
        console.error(`[AIService] Recovery error:`, err.message);
    } finally {
        isRecovering = false;
        if (conn) conn.release();
    }
};

const getQueueStatus = async () => {
    let conn;
    try {
        conn = await pool.getConnection();
        const [stats] = await conn.query(`
            SELECT 
                ai_grading_status,
                COUNT(*) as count
            FROM submissions
            WHERE ai_grading_status IS NOT NULL AND ai_grading_status != 'not_required'
            GROUP BY ai_grading_status
        `);

        return {
            active: activeJobs,
            maxConcurrent: MAX_CONCURRENT_JOBS,
            dbStats: stats
        };
    } catch (err) {
        return { active: activeJobs, maxConcurrent: MAX_CONCURRENT_JOBS, error: err.message };
    } finally {
        if (conn) conn.release();
    }
};

/**
 * Force retry all failed submissions
 */
const retryAllFailed = async () => {
    let conn;
    try {
        conn = await pool.getConnection();
        const [result] = await conn.query(`
            UPDATE submissions 
            SET ai_grading_status = 'pending',
                ai_grading_retry_count = 0,
                ai_grading_error = NULL
            WHERE ai_grading_status = 'failed'
        `);

        console.log(`[AIService] 🔄 Reset ${result.affectedRows} failed submissions to pending`);

        // Trigger recovery
        recoverPendingSubmissions();

        return result.affectedRows;
    } catch (err) {
        console.error(`[AIService] Error resetting failed:`, err.message);
        return 0;
    } finally {
        if (conn) conn.release();
    }
};

// Auto-initialize on module load
initialize();

module.exports = {
    gradeSubmission,
    getQueueStatus,
    retryAllFailed,
    recoverPendingSubmissions
};
