const axios = require("axios");
const { pool } = require("../config/db");

// ═══════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const MAX_CONCURRENT_JOBS = 20;       // Reduced to avoid overwhelming AI service
const GRADING_TIMEOUT = 90000;       // 90 seconds per AI request
const MAX_RETRIES = 10;               // Max retries per essay
const RETRY_DELAY_BASE = 2000;       // 2 second base delay
const RECOVERY_INTERVAL = 10000;     // Check for pending/failed every 10s
const STALE_TIMEOUT = 180000;        // 3 minutes - mark as stale if in_progress too long
const IMMEDIATE_RETRY_DELAY = 3000;  // Retry failed submission after 3s

// ═══════════════════════════════════════════════════════
// JOB TRACKING & DEDUPLICATION
// ═══════════════════════════════════════════════════════
let activeJobs = 0;
let recoveryInterval = null;
let isRecovering = false;
const inFlightSubmissions = new Set();  // Deduplication: track in-flight submission IDs

/**
 * Initialize the AI grading service with recovery
 */
const initialize = () => {
    console.log("[AIService] 🚀 Initializing AI Grading Service...");
    console.log(`[AIService] ⚙️ Config: MAX_CONCURRENT=${MAX_CONCURRENT_JOBS}, TIMEOUT=${GRADING_TIMEOUT}ms, MAX_RETRIES=${MAX_RETRIES}, RECOVERY_INTERVAL=${RECOVERY_INTERVAL}ms`);

    // Run recovery on startup
    setTimeout(() => {
        console.log("[AIService] 🔍 Running startup recovery check...");
        recoverPendingSubmissions();
    }, 5000);

    // Start background recovery worker (every 10s)
    recoveryInterval = setInterval(() => {
        if (!isRecovering) {
            recoverPendingSubmissions();
        }
    }, RECOVERY_INTERVAL);

    console.log(`[AIService] ✅ Background recovery worker started (every ${RECOVERY_INTERVAL / 1000}s)`);
};

// ═══════════════════════════════════════════════════════
// MAIN ENTRY: gradeSubmission
// ═══════════════════════════════════════════════════════

/**
 * Add a submission to grading queue with deduplication.
 * Safe to call multiple times — duplicate calls are ignored.
 * @param {number} submissionId 
 */
const gradeSubmission = async (submissionId) => {
    // ── DEDUP GUARD 1: In-memory check ──
    if (inFlightSubmissions.has(submissionId)) {
        console.log(`[AIService] ⚡ Submission ${submissionId} already in-flight, skipping duplicate call`);
        return;
    }

    let conn;
    try {
        conn = await pool.getConnection();

        // ── DEDUP GUARD 2: DB-level check ──
        // Skip if already completed, or currently being processed
        const [existing] = await conn.query(`
            SELECT ai_grading_status FROM submissions WHERE id = ? LIMIT 1
        `, [submissionId]);

        if (existing[0]) {
            const status = existing[0].ai_grading_status;
            if (status === 'completed') {
                console.log(`[AIService] ✅ Submission ${submissionId} already completed, skipping`);
                return;
            }
            if (status === 'in_progress') {
                console.log(`[AIService] ⏳ Submission ${submissionId} already in_progress, skipping`);
                return;
            }
        }

        // Check if submission has essay questions
        const [essays] = await conn.query(`
            SELECT COUNT(*) as count FROM student_answers sa
            JOIN exam_questions q ON q.id = sa.question_id
            WHERE sa.submission_id = ? AND q.type = 'Essay' AND sa.answer_text IS NOT NULL
        `, [submissionId]);

        if (!essays[0] || essays[0].count === 0) {
            await conn.query(`
                UPDATE submissions 
                SET ai_grading_status = 'not_required'
                WHERE id = ?
            `, [submissionId]);
            console.log(`[AIService] ℹ️ Submission ${submissionId}: No essays, skipped`);
            return;
        }

        // ── ATOMIC CLAIM: Only update if not already claimed ──
        const [claimResult] = await conn.query(`
            UPDATE submissions 
            SET ai_grading_status = 'pending', 
                ai_grading_retry_count = 0,
                ai_grading_error = NULL
            WHERE id = ? AND ai_grading_status NOT IN ('in_progress', 'completed')
        `, [submissionId]);

        if (claimResult.affectedRows === 0) {
            console.log(`[AIService] ⚡ Submission ${submissionId} already claimed by another process, skipping`);
            return;
        }

        console.log(`[AIService] 📥 Queued submission ${submissionId} (${essays[0].count} essays)`);

        // Process immediately if capacity available
        processSubmission(submissionId);

    } catch (err) {
        console.error(`[AIService] ❌ Error queuing submission ${submissionId}:`, err.message);
    } finally {
        if (conn) conn.release();
    }
};

// ═══════════════════════════════════════════════════════
// PROCESS A SINGLE SUBMISSION
// ═══════════════════════════════════════════════════════

/**
 * Process a single submission with full deduplication and retry.
 * @param {number} submissionId 
 * @param {number} retryAttempt - 0 = first try, 1 = immediate retry
 */
const processSubmission = async (submissionId, retryAttempt = 0) => {
    // ── DEDUP: Already processing this submission? ──
    if (inFlightSubmissions.has(submissionId)) {
        console.log(`[AIService] ⚡ Submission ${submissionId} already being processed in-flight, skipping`);
        return;
    }

    if (activeJobs >= MAX_CONCURRENT_JOBS) {
        console.log(`[AIService] ⏳ Queue full (${activeJobs}/${MAX_CONCURRENT_JOBS}), submission ${submissionId} will be picked up by recovery`);
        return;
    }

    // ── CLAIM in-memory + DB atomically ──
    inFlightSubmissions.add(submissionId);
    activeJobs++;

    let conn;
    try {
        conn = await pool.getConnection();

        // ── ATOMIC DB CLAIM: Only take if status allows ──
        const [claimResult] = await conn.query(`
            UPDATE submissions 
            SET ai_grading_status = 'in_progress',
                ai_grading_started_at = NOW()
            WHERE id = ? AND ai_grading_status IN ('pending', 'failed')
        `, [submissionId]);

        if (claimResult.affectedRows === 0) {
            console.log(`[AIService] ⚡ Submission ${submissionId} already claimed (race avoided)`);
            return;  // Another process got it first
        }

        console.log(`[AIService] 🚀 Processing submission ${submissionId} (attempt ${retryAttempt + 1}). Active: ${activeJobs}/${MAX_CONCURRENT_JOBS}`);

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
        console.error(`[AIService] ❌ Failed submission ${submissionId} (attempt ${retryAttempt + 1}):`, err.message);

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

        // ── IMMEDIATE RETRY: Try once more after short delay ──
        if (retryAttempt < 1) {
            console.log(`[AIService] 🔄 Scheduling immediate retry for submission ${submissionId} in ${IMMEDIATE_RETRY_DELAY}ms...`);
            inFlightSubmissions.delete(submissionId);  // Allow retry to claim
            setTimeout(() => processSubmission(submissionId, retryAttempt + 1), IMMEDIATE_RETRY_DELAY);
        }
    } finally {
        activeJobs = Math.max(0, activeJobs - 1);
        inFlightSubmissions.delete(submissionId);
        if (conn) conn.release();
    }
};

// ═══════════════════════════════════════════════════════
// CORE GRADING LOGIC (per-answer resilience)
// ═══════════════════════════════════════════════════════

/**
 * Grade all essays in a submission.
 * Per-answer resilience: if 1 essay fails, others still get saved.
 */
const performGrading = async (submissionId, conn) => {
    const startTime = Date.now();

    // Fetch Essay Answers
    const [answers] = await conn.query(`
        SELECT sa.id, sa.answer_text, sa.question_id, sa.student_id,
               q.model_answer, q.points AS max_points,
               e.grading_mode
        FROM student_answers sa
        JOIN exam_questions q ON sa.question_id = q.id
        JOIN submissions s ON sa.submission_id = s.id
        JOIN exams e ON s.exam_id = e.id
        WHERE sa.submission_id = ? AND q.type = 'Essay'
    `, [submissionId]);

    if (!answers || answers.length === 0) {
        return;
    }

    let totalAIScore = 0;
    let gradedCount = 0;
    let failedCount = 0;
    let failedDetails = [];

    // Grade each answer with per-answer resilience
    for (const ans of answers) {
        if (!ans.answer_text || ans.answer_text.trim() === "") {
            // Empty answer → score 0, mark as graded
            try {
                await conn.query(`
                    UPDATE student_answers 
                    SET score = 0, status = 'graded', graded_at = NOW()
                    WHERE id = ?
                `, [ans.id]);
            } catch (e) { /* ignore */ }
            gradedCount++;
            continue;
        }

        try {
            const aiResult = await callAIService(ans.answer_text, ans.model_answer, ans.max_points, ans.grading_mode);

            if (aiResult && aiResult.score !== undefined) {
                let { score, confidence, explanation, type } = aiResult;

                // ── VALIDATE SCORE ──
                if (typeof score !== 'number' || isNaN(score)) {
                    console.warn(`[AIService] ⚠️ Invalid score from AI (NaN): Answer ${ans.id}, using 0`);
                    score = 0;
                }

                // Clamp score to valid range [0, max_points]
                if (score < 0) {
                    console.warn(`[AIService] ⚠️ AI returned negative score (${score}): Answer ${ans.id}, clamping to 0`);
                    score = 0;
                } else if (score > ans.max_points) {
                    console.warn(`[AIService] ⚠️ AI returned score > max_points (${score}/${ans.max_points}): Answer ${ans.id}, clamping to max`);
                    score = ans.max_points;
                }

                // ── SAVE SCORE immediately (per-answer, not batch) ──
                await conn.query(`
                    UPDATE student_answers 
                    SET score = ?, status = 'graded', graded_at = NOW()
                    WHERE id = ?
                `, [score, ans.id]);

                // Log to ai_logs
                try {
                    await conn.query(`
                        INSERT INTO ai_logs (question_id, student_id, student_answer, model_answer, similarity_score, ai_suggested_score, request_payload, response_payload)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        ans.question_id,
                        ans.student_id,
                        ans.answer_text,
                        ans.model_answer,
                        confidence || 0,
                        score,
                        JSON.stringify({ student: ans.answer_text.substring(0, 200), model: ans.model_answer?.substring(0, 200) }),
                        JSON.stringify(aiResult)
                    ]);

                    // Log diagnosis for 0 scores
                    if (score === 0) {
                        console.log(`[AIService] 📋 Answer ${ans.id} scored 0: type="${type}", explanation="${explanation}", gradeType="${aiResult.type}"`);
                    }
                } catch (logErr) {
                    // Non-critical: log error but continue
                    console.warn(`[AIService] ⚠️ ai_logs insert error (non-critical):`, logErr.message);
                }

                totalAIScore += score;
                gradedCount++;
            } else {
                failedCount++;
                failedDetails.push(`Q${ans.question_id}: AI returned null`);
            }
        } catch (ansErr) {
            failedCount++;
            failedDetails.push(`Q${ans.question_id}: ${ansErr.message}`);
            console.error(`[AIService] ⚠️ Answer ${ans.id} failed:`, ansErr.message);
            // Continue to next answer — don't abort the whole submission
        }
    }

    // ── UPDATE Submission totals (even if some answers failed) ──
    if (gradedCount > 0) {
        await conn.query(`
            UPDATE submissions 
            SET ai_score = ?, 
                suggested_total_score = total_score + ?
            WHERE id = ?
        `, [totalAIScore, totalAIScore, submissionId]);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[AIService] 📊 Submission ${submissionId}: AI_Score=${totalAIScore}, Graded=${gradedCount}/${answers.length}, Failed=${failedCount}, Time=${elapsed}ms`);

    // Only throw if ALL answers failed (partial success is acceptable)
    if (failedCount > 0 && gradedCount === 0) {
        throw new Error(`All ${failedCount} essays failed to grade: ${failedDetails.join('; ')}`);
    }

    // If some failed but some succeeded, log warning but don't throw
    if (failedCount > 0 && gradedCount > 0) {
        console.warn(`[AIService] ⚠️ Submission ${submissionId}: ${failedCount} essays failed but ${gradedCount} succeeded. Partial grading saved.`);
    }
};

// ═══════════════════════════════════════════════════════
// CALL AI SERVICE (with exponential backoff retry)
// ═══════════════════════════════════════════════════════

/**
 * Call AI Service with retry and timeout.
 * On retryable errors, backs off exponentially.
 */
const callAIService = async (studentAnswer, modelAnswer, maxPoints, gradingMode = 'general', retryCount = 0) => {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/grade`, {
            student_answer: studentAnswer,
            model_answer: modelAnswer,
            max_points: maxPoints,
            grading_mode: gradingMode
        }, {
            timeout: GRADING_TIMEOUT,
            headers: { 'Content-Type': 'application/json' }
        });

        return response.data;
    } catch (err) {
        const isRetryable = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ESOCKETTIMEDOUT'].includes(err.code)
            || err.response?.status === 429
            || err.response?.status >= 500;

        if (retryCount < MAX_RETRIES && isRetryable) {
            const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
            console.log(`[AIService] 🔄 Retry ${retryCount + 1}/${MAX_RETRIES} for AI call after ${delay}ms (${err.code || err.response?.status || 'unknown'})`);
            await new Promise(r => setTimeout(r, delay));
            return callAIService(studentAnswer, modelAnswer, maxPoints, gradingMode, retryCount + 1);
        }

        if (err.code === 'ECONNREFUSED') {
            console.error(`[AIService] 🔌 AI Service not available at ${AI_SERVICE_URL}`);
        }

        return null;
    }
};

// ═══════════════════════════════════════════════════════
// BACKGROUND RECOVERY WORKER
// ═══════════════════════════════════════════════════════

/**
 * Recover pending/failed/stale submissions.
 * Runs every RECOVERY_INTERVAL to catch anything that was missed.
 */
const recoverPendingSubmissions = async () => {
    if (isRecovering) return;
    isRecovering = true;

    let conn;
    try {
        conn = await pool.getConnection();

        // Find submissions that need processing
        const [pending] = await conn.query(`
            SELECT id, ai_grading_status, ai_grading_retry_count
            FROM submissions
            WHERE ai_grading_status = 'pending'
               OR (ai_grading_status = 'failed' AND ai_grading_retry_count < ?)
               OR (ai_grading_status = 'in_progress' AND ai_grading_started_at < DATE_SUB(NOW(), INTERVAL 3 MINUTE))
            ORDER BY 
                CASE ai_grading_status 
                    WHEN 'pending' THEN 0 
                    WHEN 'in_progress' THEN 1 
                    WHEN 'failed' THEN 2 
                END,
                id ASC
            LIMIT 50
        `, [MAX_RETRIES]);

        if (pending && pending.length > 0) {
            console.log(`[AIService] 🔍 Recovery found ${pending.length} submissions to process`);

            for (const sub of pending) {
                // Skip if already in-flight (dedup)
                if (inFlightSubmissions.has(sub.id)) {
                    continue;
                }

                if (activeJobs >= MAX_CONCURRENT_JOBS) {
                    console.log(`[AIService] ⏳ Recovery: Queue full, will continue next cycle`);
                    break;
                }

                // Reset stale in_progress submissions to pending
                if (sub.ai_grading_status === 'in_progress') {
                    console.log(`[AIService] ♻️ Resetting stale submission ${sub.id} from in_progress to pending`);
                    await conn.query(`
                        UPDATE submissions 
                        SET ai_grading_status = 'pending'
                        WHERE id = ? AND ai_grading_status = 'in_progress'
                    `, [sub.id]);
                }

                // Process it
                processSubmission(sub.id);

                // Small delay between starting jobs to avoid burst
                await new Promise(r => setTimeout(r, 200));
            }
        }

    } catch (err) {
        console.error(`[AIService] Recovery error:`, err.message);
    } finally {
        isRecovering = false;
        if (conn) conn.release();
    }
};

// ═══════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════

/**
 * Get current queue status (for admin/API use)
 */
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
            inFlight: Array.from(inFlightSubmissions),
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

        // Trigger recovery immediately
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
