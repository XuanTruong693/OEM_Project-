const { pool } = require('../../config/db');
const { gradeSubmission } = require('../../services/AIService');

exports.getAIGradingLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (page - 1) * limit;
    const isMissedTab = status === 'missed';

    // Base where clause including missed submissions if they have essay answers
    const missedSubCondition = `
      (s.ai_grading_status IS NULL AND EXISTS (
        SELECT 1 FROM student_answers sa
        JOIN exam_questions q ON sa.question_id = q.id
        WHERE sa.submission_id = s.id AND q.type = 'Essay' AND sa.answer_text IS NOT NULL
      ))
    `;

    const modifiedSubCondition = `
      EXISTS (
        SELECT 1 FROM student_answers sa_mod
        JOIN (
            SELECT al1.question_id, al1.submission_id, al1.ai_suggested_score
            FROM ai_logs al1
            INNER JOIN (
                SELECT question_id, submission_id, MAX(created_at) as max_time 
                FROM ai_logs 
                GROUP BY question_id, submission_id
            ) al2 ON al1.question_id = al2.question_id 
                 AND al1.submission_id = al2.submission_id 
                 AND al1.created_at = al2.max_time
        ) latest_al ON sa_mod.question_id = latest_al.question_id AND s.id = latest_al.submission_id
        WHERE sa_mod.submission_id = s.id 
        AND (
            (latest_al.ai_suggested_score IS NOT NULL AND ABS(sa_mod.score - latest_al.ai_suggested_score) > 0.001)
            OR
            (latest_al.ai_suggested_score IS NULL AND sa_mod.score > 0 AND (sa_mod.status = 'graded' OR sa_mod.status = 'confirmed'))
        )
      )
    `;

    let whereClause = "";
    if (isMissedTab) {
        whereClause = missedSubCondition;
    } else if (status === 'instructor_modified') {
        whereClause = modifiedSubCondition;
    } else if (status && status !== 'all') {
        whereClause = `s.ai_grading_status = ?`;
    } else {
        // 'all' tab: Show ones with status NOT NULL + skipped ones that HAVE essays
        whereClause = `(s.ai_grading_status IS NOT NULL AND s.ai_grading_status != 'not_required') OR ${missedSubCondition}`;
    }

    const params = [];
    if (status && status !== 'all' && !isMissedTab && status !== 'instructor_modified') {
        params.push(status);
    }
    
    if (search) {
      whereClause = `(${whereClause}) AND (u.full_name LIKE ? OR u.email LIKE ? OR e.title LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [logs] = await pool.query(`
      SELECT 
        s.id as submission_id,
        s.exam_id,
        e.title as exam_title,
        s.user_id as student_id,
        u.full_name as student_name,
        u.email as student_email,
        s.ai_grading_status as status,
        s.ai_grading_error as error,
        s.ai_grading_retry_count as retry_count,
        s.ai_grading_started_at as started_at,
        s.submitted_at,
        (
          SELECT 1 FROM student_answers sa_check
          JOIN (
              SELECT al3.question_id, al3.submission_id, al3.ai_suggested_score
              FROM ai_logs al3
              INNER JOIN (
                  SELECT question_id, submission_id, MAX(created_at) as max_time 
                  FROM ai_logs 
                  GROUP BY question_id, submission_id
              ) al4 ON al3.question_id = al4.question_id 
                   AND al3.submission_id = al4.submission_id 
                   AND al3.created_at = al4.max_time
          ) latest_check ON sa_check.question_id = latest_check.question_id AND s.id = latest_check.submission_id
          WHERE sa_check.submission_id = s.id 
          AND (
              (latest_check.ai_suggested_score IS NOT NULL AND ABS(sa_check.score - latest_check.ai_suggested_score) > 0.001)
              OR
              (latest_check.ai_suggested_score IS NULL AND sa_check.score > 0 AND (sa_check.status = 'graded' OR sa_check.status = 'confirmed'))
          )
          LIMIT 1
        ) IS NOT NULL as is_instructor_modified
      FROM submissions s
      LEFT JOIN exams e ON s.exam_id = e.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE ${whereClause}
      ORDER BY 
        CASE 
            WHEN s.ai_grading_status IS NULL THEN 1
            WHEN s.ai_grading_status = 'failed' THEN 2
            WHEN s.ai_grading_status = 'pending' THEN 3
            WHEN s.ai_grading_status = 'in_progress' THEN 4
            ELSE 5
        END,
        s.submitted_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const [[{ total }]] = await pool.query(`
      SELECT COUNT(*) as total 
      FROM submissions s
      LEFT JOIN exams e ON s.exam_id = e.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE ${whereClause}
    `, params);

    // Get count stats
    const [stats] = await pool.query(`
      SELECT ai_grading_status as status, COUNT(*) as count
      FROM submissions
      WHERE ai_grading_status IS NOT NULL AND ai_grading_status != 'not_required'
      GROUP BY ai_grading_status
    `);
    
    // Get missed count (Has essay but ai_grading_status is NULL)
    const [[{ missed_count }]] = await pool.query(`
      SELECT COUNT(*) as missed_count 
      FROM submissions s
      WHERE s.ai_grading_status IS NULL
      AND EXISTS (
        SELECT 1 FROM student_answers sa
        JOIN exam_questions q ON sa.question_id = q.id
        WHERE sa.submission_id = s.id AND q.type = 'Essay' AND sa.answer_text IS NOT NULL
      )
    `);
    
    const summary = { total: 0, pending: 0, in_progress: 0, completed: 0, failed: 0, missed: missed_count };
    stats.forEach(row => {
      summary[row.status] = row.count;
      summary.total += row.count;
    });
    summary.total += missed_count;

    res.json({
        success: true,
        summary,
        logs,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Error fetching AI grading logs:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAIGradingLogDetail = async (req, res) => {
    try {
        const { submissionId } = req.params;

        const [submission] = await pool.query(`
            SELECT 
                s.id as submission_id,
                e.title as exam_title,
                u.full_name as student_name,
                u.email as student_email,
                s.ai_grading_status as status,
                s.ai_grading_error as error,
                s.ai_grading_retry_count as retry_count,
                s.total_score,
                s.ai_score,
                s.suggested_total_score
            FROM submissions s
            JOIN exams e ON s.exam_id = e.id
            JOIN users u ON s.user_id = u.id
            WHERE s.id = ?
        `, [submissionId]);

        if (!submission.length) {
            return res.status(404).json({ success: false, message: 'Submission không tồn tại' });
        }

        // Fetch answers with LEFT JOIN to ai_logs, getting latest log
        const [answers] = await pool.query(`
            SELECT 
                sa.id as answer_id,
                q.id as question_id,
                q.question_text,
                q.model_answer,
                q.points as max_points,
                sa.answer_text as student_answer,
                sa.score,
                sa.status as answer_status,
                sa.instructor_feedback,
                al.ai_suggested_score,
                al.response_payload,
                al.created_at as log_time,
                al.similarity_score as confidence
            FROM student_answers sa
            JOIN exam_questions q ON sa.question_id = q.id
            LEFT JOIN (
                SELECT t1.* FROM ai_logs t1
                JOIN (SELECT question_id, submission_id, MAX(created_at) as max_time FROM ai_logs GROUP BY question_id, submission_id) t2 
                ON t1.question_id = t2.question_id AND t1.submission_id = t2.submission_id AND t1.created_at = t2.max_time
            ) al ON al.question_id = q.id AND al.submission_id = ?
            WHERE sa.submission_id = ? AND q.type = 'Essay'
            ORDER BY q.order_index ASC, q.id ASC
        `, [submissionId, submissionId]);

        const processedAnswers = answers.map(ans => {
            let ai_feedback = null;
            if (ans.response_payload) {
                try {
                    const parsed = typeof ans.response_payload === 'string' ? JSON.parse(ans.response_payload) : ans.response_payload;
                    if (parsed && typeof parsed === 'object') {
                        ai_feedback = {
                            explanation: parsed.explanation,
                            type: parsed.type || parsed.gradeType,
                            confidence: parsed.confidence || ans.confidence,
                            score: parsed.score
                        };
                    } else {
                        ai_feedback = parsed;
                    }
                } catch (e) {
                    console.error('Error parsing response_payload', e);
                }
            }
            // Determine if instructor has modified the score
            const instructor_score = ans.score;
            const ai_score = ai_feedback ? ai_feedback.score : ans.ai_suggested_score;
            const is_modified = ai_score !== null && instructor_score !== null && Number(instructor_score) !== Number(ai_score);
            const is_confirmed = ans.answer_status === 'graded' || ans.answer_status === 'confirmed';

            return {
                ...ans,
                ai_feedback,
                instructor_info: {
                    is_modified,
                    is_confirmed,
                    final_score: instructor_score,
                    ai_original_score: ai_score,
                    feedback: ans.instructor_feedback
                }
            };
        });

        res.json({
            success: true,
            submission: submission[0],
            answers: processedAnswers
        });

    } catch (error) {
        console.error('Error fetching AI grading log detail:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.retryAIGrading = async (req, res) => {
    try {
        const { submissionId } = req.params;

        const [submissions] = await pool.query(`
            SELECT ai_grading_status, user_id FROM submissions WHERE id = ?
        `, [submissionId]);

        if (!submissions.length) {
            return res.status(404).json({ success: false, message: 'Submission không tồn tại' });
        }

        if (submissions[0].ai_grading_status === 'in_progress') {
            return res.status(400).json({ success: false, message: 'Bài tập này đang được chấm điểm, không thể bắt đầu lại.' });
        }

        const studentId = submissions[0].user_id;

        // Fetch question IDs for this submission
        const [questions] = await pool.query(`
            SELECT question_id FROM student_answers sa
            JOIN exam_questions q ON sa.question_id = q.id
            WHERE sa.submission_id = ? AND q.type = 'Essay'
        `, [submissionId]);
        
        const questionIds = questions.map(q => q.question_id);

        // User requested NO LOG DELETION for audit history
        /*
        if (questionIds.length > 0) {
            await pool.query(`
                DELETE FROM ai_logs 
                WHERE student_id = ? AND question_id IN (?)
            `, [studentId, questionIds]);
        }
        */

        await pool.query(`
            UPDATE submissions 
            SET ai_grading_status = 'pending',
                ai_grading_error = NULL
            WHERE id = ?
        `, [submissionId]);

        // Kick off the grading asynchronously
        gradeSubmission(submissionId).catch(err => {
            console.error(`Error kicking off retry for submission ${submissionId}:`, err);
        });

        if (req.logActivity) {
            await req.logActivity({
                actionType: 'admin_retry_ai_grade',
                targetTable: 'submissions',
                targetId: parseInt(submissionId),
                description: `Admin bắt buộc gọi lại chấm điểm AI cho bài thi ID ${submissionId}`
            });
        }

        res.json({ success: true, message: 'Đã đưa bài thi vào hàng đợi chấm điểm AI thành công' });

    } catch (error) {
        console.error('Error retrying AI grading:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi thực hiện thử lại' });
    }
};

exports.getMissedSubmissions = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const [missed] = await pool.query(`
            SELECT 
                s.id as submission_id,
                s.exam_id,
                e.title as exam_title,
                s.user_id as student_id,
                u.full_name as student_name,
                u.email as student_email,
                'missed' as status,
                s.submitted_at
            FROM submissions s
            LEFT JOIN exams e ON s.exam_id = e.id
            LEFT JOIN users u ON s.user_id = u.id
            WHERE s.ai_grading_status IS NULL
            AND EXISTS (
                SELECT 1 FROM student_answers sa
                JOIN exam_questions q ON sa.question_id = q.id
                WHERE sa.submission_id = s.id AND q.type = 'Essay' AND sa.answer_text IS NOT NULL
            )
            ORDER BY s.submitted_at DESC
            LIMIT ? OFFSET ?
        `, [parseInt(limit), parseInt(offset)]);

        const [[{ total }]] = await pool.query(`
            SELECT COUNT(*) as total 
            FROM submissions s
            WHERE s.ai_grading_status IS NULL
            AND EXISTS (
                SELECT 1 FROM student_answers sa
                JOIN exam_questions q ON sa.question_id = q.id
                WHERE sa.submission_id = s.id AND q.type = 'Essay' AND sa.answer_text IS NOT NULL
            )
        `);

        res.json({
            success: true,
            logs: missed,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error fetching missed submissions:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.forceRegradeBatch = async (req, res) => {
    try {
        const { mode, startDate, endDate, limit } = req.body;
        
        let whereClause = "1=1";
        const params = [];

        // Apply filters
        if (startDate) {
            whereClause += " AND s.submitted_at >= ?";
            params.push(startDate);
        }
        if (endDate) {
            whereClause += " AND s.submitted_at <= ?";
            params.push(endDate);
        }

        // Apply mode
        if (mode === 'missed_only') {
            whereClause += " AND s.ai_grading_status IS NULL";
        } else if (mode === 'failed_only') {
            whereClause += " AND s.ai_grading_status = 'failed'";
        } else {
            // mode 'all'
            whereClause += " AND (s.ai_grading_status IS NULL OR s.ai_grading_status != 'not_required')";
        }

        // Ensure they have essays
        whereClause += ` AND EXISTS (
            SELECT 1 FROM student_answers sa
            JOIN exam_questions q ON sa.question_id = q.id
            WHERE sa.submission_id = s.id AND q.type = 'Essay' AND sa.answer_text IS NOT NULL
        )`;

        // Fetch IDs first to apply limit if needed
        let query = `SELECT s.id FROM submissions s WHERE ${whereClause} ORDER BY s.submitted_at DESC`;
        if (limit) {
            query += ` LIMIT ${parseInt(limit)}`;
        }

        const [submissions] = await pool.query(query, params);
        
        if (submissions.length === 0) {
            return res.json({ success: true, message: 'Không tìm thấy bài thi nào thỏa mãn bộ lọc', affectedRows: 0 });
        }

        const subIds = submissions.map(s => s.id);

        // Batch Reset Scores and Status
        // Note: As per user request, we DO NOT delete ai_logs.
        await pool.query(`
            UPDATE submissions 
            SET ai_grading_status = 'pending',
                ai_score = NULL,
                ai_grading_error = NULL,
                ai_grading_retry_count = 0
            WHERE id IN (?)
        `, [subIds]);

        // Also reset per-answer scores for clarity
        await pool.query(`
            UPDATE student_answers sa
            JOIN exam_questions q ON sa.question_id = q.id
            SET sa.score = 0, sa.status = 'pending'
            WHERE sa.submission_id IN (?) AND q.type = 'Essay'
        `, [subIds]);

        if (req.logActivity) {
            await req.logActivity({
                actionType: 'admin_batch_regrade',
                targetTable: 'submissions',
                description: `Admin ép chấm lại hàng loạt cho ${subIds.length} bài thi. Mode: ${mode}`
            });
        }

        res.json({ 
            success: true, 
            message: `Đã đưa ${subIds.length} bài thi vào hàng đợi chấm điểm thành công`,
            affectedRows: subIds.length
        });

    } catch (error) {
        console.error('Error in batch regrade:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi thực hiện chấm hàng loạt' });
    }
};

exports.getBatchRegradePreview = async (req, res) => {
    try {
        const { mode, startDate, endDate, limit } = req.query;
        
        let whereClause = "1=1";
        const params = [];

        if (startDate) {
            whereClause += " AND s.submitted_at >= ?";
            params.push(startDate);
        }
        if (endDate) {
            whereClause += " AND s.submitted_at <= ?";
            params.push(endDate);
        }

        if (mode === 'missed_only') {
            whereClause += " AND s.ai_grading_status IS NULL";
        } else if (mode === 'failed_only') {
            whereClause += " AND s.ai_grading_status = 'failed'";
        } else {
            whereClause += " AND (s.ai_grading_status IS NULL OR s.ai_grading_status != 'not_required')";
        }

        whereClause += ` AND EXISTS (
            SELECT 1 FROM student_answers sa
            JOIN exam_questions q ON sa.question_id = q.id
            WHERE sa.submission_id = s.id AND q.type = 'Essay' AND sa.answer_text IS NOT NULL
        )`;

        let query = `
            SELECT 
                s.id as submission_id,
                e.title as exam_title,
                u.full_name as student_name,
                u.email as student_email,
                s.ai_grading_status as status,
                s.ai_grading_error as error,
                s.submitted_at
            FROM submissions s
            JOIN exams e ON s.exam_id = e.id
            JOIN users u ON s.user_id = u.id
            WHERE ${whereClause}
            ORDER BY s.submitted_at DESC
        `;
        
        if (limit) {
            query += ` LIMIT ${parseInt(limit)}`;
        }

        const [preview] = await pool.query(query, params);
        
        res.json({ success: true, preview });

    } catch (error) {
        console.error('Error fetching batch preview:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
