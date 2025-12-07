const axios = require("axios");
const { pool } = require("../config/db");

// Configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const MAX_CONCURRENT_JOBS = 8;

// Job Queue (In-Memory)
const jobQueue = [];
let activeJobs = 0;

/**
 * Add a submission to the grading queue
 * @param {number} submissionId 
 */
const gradeSubmission = (submissionId) => {
    console.log(`[AIService] 📥 Queuing submission ${submissionId}`);
    jobQueue.push(submissionId);
    processQueue();
};

/**
 * Process the queue respecting concurrency limit
 */
const processQueue = async () => {
    if (activeJobs >= MAX_CONCURRENT_JOBS || jobQueue.length === 0) {
        return;
    }

    // Take next job
    const submissionId = jobQueue.shift();
    activeJobs++;

    console.log(`[AIService] 🚀 Starting job for submission ${submissionId}. Active: ${activeJobs}/${MAX_CONCURRENT_JOBS}`);

    try {
        await performGrading(submissionId);
    } catch (err) {
        console.error(`[AIService] ❌ Error processing submission ${submissionId}:`, err);
    } finally {
        activeJobs--;
        if (jobQueue.length > 0) {
            processQueue(); // Trigger next
        } else {
            console.log("[AIService] ✅ Queue empty/drained.");
        }
    }
};

/**
 * Core grading logic
 */
const performGrading = async (submissionId) => {
    let conn;
    try {
        conn = await pool.getConnection();

        // 1. Fetch Essay Answers for this submission
        // We strictly filter for Essay type questions
        const [answers] = await conn.query(`
      SELECT sa.id, sa.answer_text, sa.question_id, sa.student_id,
             q.model_answer, q.points AS max_points
      FROM student_answers sa
      JOIN exam_questions q ON sa.question_id = q.id
      WHERE sa.submission_id = ? AND q.type = 'Essay'
    `, [submissionId]);

        if (!answers || answers.length === 0) {
            console.log(`[AIService] ℹ️ Submission ${submissionId} has no essay questions.`);
            return;
        }

        console.log(`[AIService] 🔍 Submission ${submissionId}: Found ${answers.length} essay answers.`);

        let totalAIScore = 0;

        // 2. Grade each answer
        for (const ans of answers) {
            if (!ans.answer_text || ans.answer_text.trim() === "") {
                console.log(`[AIService] ⚠️ Empty answer for Q ${ans.question_id}`);
                continue;
            }

            // Call Python AI Service
            const aiResult = await callAIService(ans.answer_text, ans.model_answer, ans.max_points);

            if (aiResult) {
                const { score, explanation, confidence } = aiResult;

                // Update student_answer
                await conn.query(`
          UPDATE student_answers 
          SET score = ?, status = 'graded', graded_at = NOW()
          WHERE id = ?
        `, [score, ans.id]);

                // Insert into ai_logs
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
                    JSON.stringify({ student: ans.answer_text, model: ans.model_answer }),
                    JSON.stringify(aiResult)
                ]);

                totalAIScore += score;
            }
        }

        // 3. Update Submission Totals
        // Update ai_score and recalculate suggested_total_score
        // We fetch current total_score (MCQ) just to be safe, or assume it's already set
        await conn.query(`
      UPDATE submissions 
      SET ai_score = ?, 
          suggested_total_score = total_score + ?
      WHERE id = ?
    `, [totalAIScore, totalAIScore, submissionId]);

        console.log(`[AIService] ✅ Completed submission ${submissionId}. AI Score: ${totalAIScore}`);

    } catch (err) {
        console.error(`[AIService] Grading Logic Error:`, err);
        throw err;
    } finally {
        if (conn) conn.release();
    }
};

/**
 * Call External FastAPI Service
 */
const callAIService = async (studentAnswer, modelAnswer, maxPoints) => {
    try {
        const payload = {
            student_answer: studentAnswer,
            model_answer: modelAnswer,
            max_points: maxPoints
        };

        // Assuming API endpoint is /grade
        const response = await axios.post(`${AI_SERVICE_URL}/grade`, payload);
        return response.data;
    } catch (err) {
        if (err.code === 'ECONNREFUSED') {
            console.error(`[AIService] 🔌 Connection Refused to ${AI_SERVICE_URL}. Ensure AI Service is running.`);
        } else {
            console.error(`[AIService] 🔌 API Call Failed:`, err.message);
            if (err.response) {
                console.error("Response data:", err.response.data);
                console.error("Response status:", err.response.status);
            }
        }
        return null; // Return null to skip update or handle error
    }
};

module.exports = {
    gradeSubmission
};
