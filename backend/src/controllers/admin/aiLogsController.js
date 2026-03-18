const { pool } = require('../../config/db');
const { gradeSubmission } = require('../../services/AIService');

exports.getAIGradingLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "s.ai_grading_status IS NOT NULL AND s.ai_grading_status != 'not_required'";
    const params = [];

    if (status && status !== 'all') {
      whereClause += ' AND s.ai_grading_status = ?';
      params.push(status);
    }
    
    if (search) {
      whereClause += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR e.title LIKE ?)';
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
        s.submitted_at
      FROM submissions s
      JOIN exams e ON s.exam_id = e.id
      JOIN users u ON s.user_id = u.id
      WHERE ${whereClause}
      ORDER BY 
        CASE s.ai_grading_status
            WHEN 'failed' THEN 1
            WHEN 'pending' THEN 2
            WHEN 'in_progress' THEN 3
            ELSE 4
        END,
        s.submitted_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const [[{ total }]] = await pool.query(`
      SELECT COUNT(*) as total 
      FROM submissions s
      JOIN exams e ON s.exam_id = e.id
      JOIN users u ON s.user_id = u.id
      WHERE ${whereClause}
    `, params);

    // Get count stats
    const [stats] = await pool.query(`
      SELECT ai_grading_status as status, COUNT(*) as count
      FROM submissions
      WHERE ai_grading_status IS NOT NULL AND ai_grading_status != 'not_required'
      GROUP BY ai_grading_status
    `);
    
    const summary = { total: 0, pending: 0, in_progress: 0, completed: 0, failed: 0 };
    stats.forEach(row => {
      summary[row.status] = row.count;
      summary.total += row.count;
    });

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
                al.ai_suggested_score,
                al.response_payload,
                al.created_at as log_time,
                al.similarity_score as confidence
            FROM student_answers sa
            JOIN exam_questions q ON sa.question_id = q.id
            LEFT JOIN (
                SELECT t1.* FROM ai_logs t1
                JOIN (SELECT question_id, student_id, MAX(created_at) as max_time FROM ai_logs GROUP BY question_id, student_id) t2 
                ON t1.question_id = t2.question_id AND t1.student_id = t2.student_id AND t1.created_at = t2.max_time
            ) al ON al.question_id = q.id AND al.student_id = (SELECT user_id FROM submissions WHERE id = ?)
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
            return {
                ...ans,
                ai_feedback
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

        if (questionIds.length > 0) {
            await pool.query(`
                DELETE FROM ai_logs 
                WHERE student_id = ? AND question_id IN (?)
            `, [studentId, questionIds]);
        }

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
