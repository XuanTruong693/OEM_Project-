const { pool } = require("../config/db");
const { broadcastCheatingEvent } = require("../services/socketService");
const axios = require("axios");

const CHEATING_TYPES = {
  blocked_key: "high",
  visibility_hidden: "medium",
  fullscreen_lost: "high",
  fullscreen_exit_attempt: "high",
  window_blur: "medium",
  tab_switch: "high",
  alt_tab: "high",
  multiple_faces: "high",
  no_face_detected: "medium",
  copy_paste: "high",
  inactivity: "low", // Không thao tác quá 1 phút
  split_screen: "medium",
};

const recentEvents = new Map();
const DEDUP_WINDOW = 500;

exports.postProctorEvent = async (req, res) => {
  const submissionId = req.params.submissionId || req.params.id;
  const { event_type, details } = req.body;

  // Validate required fields
  if (!event_type) {
    console.error("❌ [Proctor] Missing event_type");
    return res.status(400).json({ error: "event_type is required" });
  }

  if (!submissionId || isNaN(parseInt(submissionId))) {
    console.error("❌ [Proctor] Invalid submissionId:", submissionId);
    return res.status(400).json({ error: "Invalid submissionId" });
  }

  const eventKey = `${submissionId}-${event_type}`;
  const lastEventTime = recentEvents.get(eventKey);
  const now = Date.now();

  if (lastEventTime && now - lastEventTime < DEDUP_WINDOW) {
    console.log(
      `⏸️ [Proctor] DUPLICATE EVENT THROTTLED: ${eventKey} (${now - lastEventTime
      }ms since last)`
    );
    return res.status(429).json({
      error: "Event throttled - duplicate within window",
      throttledMs: DEDUP_WINDOW,
    });
  }

  recentEvents.set(eventKey, now);

  if (recentEvents.size > 1000) {
    const cutoff = now - 60 * 60 * 1000;
    for (const [key, time] of recentEvents.entries()) {
      if (time < cutoff) recentEvents.delete(key);
    }
  }

  let conn;
  try {
    conn = await pool.getConnection();

    let severity = CHEATING_TYPES[event_type];
    // Dynamic AI events
    if (!severity && event_type.startsWith("ai_")) {
      severity = "high";
    }

    const isCheating = !!severity;

    let updatedCheatingCount = null;

    if (isCheating) {

      const [subRows] = await conn.query(
        "SELECT user_id, exam_id FROM submissions WHERE id = ? LIMIT 1",
        [submissionId]
      );

      if (subRows && subRows[0]) {
        const { user_id: studentId, exam_id: examId } = subRows[0];

        // Get student name for notification
        const [studentRows] = await conn.query(
          "SELECT full_name FROM users WHERE id = ? LIMIT 1",
          [studentId]
        );
        const studentName =
          studentRows?.[0]?.full_name || `Student ${studentId}`;

        // ✅ Insert into cheating_logs table WITHOUT transaction (to avoid deadlock)
        let insertSuccessful = false;
        try {
          const [insertResult] = await conn.query(
            `INSERT INTO cheating_logs 
             (submission_id, student_id, exam_id, event_type, event_details, severity) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              submissionId,
              studentId,
              examId,
              event_type,
              JSON.stringify(details || {}),
              severity,
            ]
          );
          insertSuccessful = true;
          //console.log(`✅ [Proctor] Cheating logged with ID: ${insertResult.insertId}`);
        } catch (insertErr) {
          console.warn(
            "⚠️ [Proctor] Insert error, retrying:",
            insertErr.message
          );
          // Retry once after small delay
          await new Promise((resolve) => setTimeout(resolve, 100));
          try {
            await conn.query(
              `INSERT INTO cheating_logs 
               (submission_id, student_id, exam_id, event_type, event_details, severity) 
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                submissionId,
                studentId,
                examId,
                event_type,
                JSON.stringify(details || {}),
                severity,
              ]
            );
            insertSuccessful = true;
          } catch (retryErr) {
            console.error("❌ [Proctor] Retry failed:", retryErr.message);
            insertSuccessful = false;
          }
        }
        // Get updated count
        const [countResult] = await conn.query(
          "SELECT cheating_count FROM submissions WHERE id = ? LIMIT 1",
          [submissionId]
        );

        updatedCheatingCount = countResult[0]?.cheating_count || 0;

        console.log(
          `📊 [Proctor] Current cheating_count: ${updatedCheatingCount} for submission ${submissionId}`
        );

        //cheating event tới tất cả instructors của exam này
        broadcastCheatingEvent(examId, {
          submissionId: parseInt(submissionId),
          studentId: parseInt(studentId),
          studentName,
          eventType: event_type,
          severity,
          detectedAt: new Date(),
          eventDetails: details || {},
          cheatingCount: updatedCheatingCount,
        });
      }
    } else {
      //console.log(`ℹ️ [Proctor] Non-cheating event: ${event_type}`);
    }

    conn.release();

    res.status(200).json({
      success: true,
      is_cheating: isCheating,
      severity: severity || null,
      cheating_count: updatedCheatingCount,
      message: isCheating
        ? `Cheating event logged: ${event_type}`
        : `Event logged: ${event_type}`,
    });
  } catch (err) {
    if (conn) {
      conn.release();
    }
    console.error("❌ [Proctor] Error logging event:", err);
    res
      .status(500)
      .json({ error: "Failed to log proctor event", details: err.message });
  }
};

exports.getExamViolations = async (req, res) => {
  const { examId } = req.params;
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      `
      SELECT 
        pe.id,
        pe.event_type,
        pe.timestamp,
        pe.details,
        pe.is_cheating,
        u.full_name AS student_name,
        s.user_id AS student_id,
        s.cheating_count,
        s.id AS submission_id
      FROM proctor_events pe
      JOIN submissions s ON pe.submission_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE s.exam_id = ?
        AND pe.timestamp > DATE_SUB(NOW(), INTERVAL 5 MINUTE) -- 5 phút gần nhất, tuỳ chỉnh
      ORDER BY pe.timestamp DESC
    `,
      [examId]
    );
    conn.release();
    res.json(rows);
  } catch (err) {
    console.error("Error getting violations:", err);
    res.status(500).json({ error: "Failed to get violations" });
  }
};

exports.getStudentExamDetail = async (req, res) => {
  const { examId, studentId } = req.params;
  try {
    const conn = await pool.getConnection();
    const [submissionRows] = await conn.query(
      `
      SELECT s.*, u.full_name AS student_name
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.exam_id = ? AND s.user_id = ?
    `,
      [examId, studentId]
    );
    if (submissionRows.length === 0) {
      conn.release();
      return res.status(404).json({ error: "Submission not found" });
    }
    const submission = submissionRows[0];

    const [answers] = await conn.query(
      `
      SELECT sa.*, q.question_text, q.type, q.points
      FROM student_answers sa
      JOIN exam_questions q ON sa.question_id = q.id
      WHERE sa.submission_id = ?
      ORDER BY CASE WHEN q.type = 'MCQ' THEN 0 ELSE 1 END, COALESCE(q.order_index, 0) ASC, q.id ASC
    `,
      [submission.id]
    );

    const [violations] = await conn.query(
      `
      SELECT * FROM proctor_events WHERE submission_id = ?
      ORDER BY timestamp DESC
    `,
      [submission.id]
    );

    const [aiLogs] = await conn.query(
      `
      SELECT * FROM ai_logs WHERE student_id = ? AND question_id IN (SELECT id FROM exam_questions WHERE exam_id = ?)
    `,
      [studentId, examId]
    );

    conn.release();
    res.json({ submission, answers, violations, aiLogs });
  } catch (err) {
    console.error("Error getting student detail:", err);
    res.status(500).json({ error: "Failed to get student detail" });
  }
};

//Get cheating details for a specific student submission
exports.getStudentCheatingDetails = async (req, res) => {
  const { submissionId } = req.params;
  try {
    const conn = await pool.getConnection();
    const [cheatingLogs] = await conn.query(
      `SELECT 
        cl.id,
        cl.event_type,
        cl.event_details,
        cl.detected_at,
        cl.severity,
        u.full_name AS student_name,
        e.title AS exam_title
       FROM cheating_logs cl
       JOIN submissions s ON s.id = cl.submission_id
       JOIN users u ON u.id = cl.student_id
       JOIN exams e ON e.id = cl.exam_id
       WHERE cl.submission_id = ?
       ORDER BY cl.detected_at DESC`,
      [submissionId]
    );

    const [summary] = await conn.query(
      `SELECT 
        COUNT(*) AS total_incidents,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) AS high_count,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) AS medium_count,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) AS low_count,
        MIN(detected_at) AS first_incident,
        MAX(detected_at) AS last_incident
       FROM cheating_logs
       WHERE submission_id = ?`,
      [submissionId]
    );

    conn.release();
    res.json({
      logs: cheatingLogs,
      summary: summary[0] || {},
    });
  } catch (err) {
    console.error("Error getting cheating details:", err);
    res.status(500).json({ error: "Failed to get cheating details" });
  }
};

exports.approveStudentScores = async (req, res) => {
  try {
    const examId = parseInt(req.params.examId, 10);
    const studentId = parseInt(req.params.studentId, 10);
    const { total_score, ai_score, student_name, mcq_score, per_question_scores } = req.body || {};

    if (!Number.isFinite(examId) || !Number.isFinite(studentId))
      return res.status(400).json({ message: "invalid ids" });

    // Use mcq_score if provided, otherwise use total_score for backward compatibility
    const mcq = mcq_score != null ? Number(mcq_score) : (total_score != null ? Number(total_score) : null);
    const ai = ai_score != null ? Number(ai_score) : null;

    if ((mcq != null && isNaN(mcq)) || (ai != null && isNaN(ai)))
      return res.status(400).json({ message: "score must be number" });

    const conn = await pool.getConnection();

    try {
      // 1. Nếu giảng viên sửa từng câu hỏi, lưu lại và push qua AI learning (bất đồng bộ)
      if (per_question_scores && Array.isArray(per_question_scores)) {
        for (const p of per_question_scores) {
          const qid = p.question_id;
          const newScore = p.score;
          
          const [qRows] = await conn.query(
            `SELECT sa.answer_text, q.model_answer, q.points, sa.score as old_score, q.type, sa.submission_id
             FROM student_answers sa
             JOIN exam_questions q ON sa.question_id = q.id
             JOIN submissions sub ON sa.submission_id = sub.id
             WHERE sa.question_id = ? AND sub.user_id = ? AND sub.exam_id = ? LIMIT 1`,
            [qid, studentId, examId]
          );
          
          if (qRows.length > 0) {
            const qInfo = qRows[0];
            await conn.query(
              `UPDATE student_answers SET score = ? WHERE question_id = ? AND submission_id = ?`,
              [newScore, qid, qInfo.submission_id]
            );
            
            // Gửi dữ liệu training cho AI
            if (qInfo.type === 'Essay') {
               try {
                   const aiUrl = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
                   // Async fire-And-forget (Không block luồng save điểm)
                   axios.post(`${aiUrl}/learn/from-correction`, {
                       student_answer: qInfo.answer_text,
                       model_answer: qInfo.model_answer,
                       old_score: parseFloat(qInfo.old_score || 0),
                       new_score: parseFloat(newScore),
                       max_points: parseFloat(qInfo.points),
                       feedback: "Sửa bài bởi giảng viên"
                   }, { timeout: 3000 }).then(() => {
                       console.log(`[AI Learning] ✅ Sent correction to AI for QID ${qid}`);
                   }).catch(e => {
                       console.log(`[AI Learning] ⚠️ Error sending correction to AI:`, e.message);
                   });
               } catch (e) {}
            }
          }
        }
      }

      // 2. Try calling SP first to update total score
      await conn.query(
        `CALL sp_update_student_exam_record(?, ?, ?, ?, ?);`,
        [examId, studentId, student_name || null, mcq, ai]
      );
    } catch (e) {
      console.warn("SP failed, using fallback:", e.message);

      // Fallback direct update
      await conn.query(
        `UPDATE submissions s 
         SET total_score = ?, 
             ai_score = ?, 
             suggested_total_score = COALESCE(?,0) + COALESCE(?,0), 
             instructor_confirmed = 1, 
             status='confirmed'
         WHERE s.exam_id = ? AND s.user_id = ?`,
        [mcq, ai, mcq, ai, examId, studentId]
      );

      // Also update results table
      try {
        await conn.query(
          `UPDATE results r 
           SET total_score = (SELECT total_score FROM submissions WHERE exam_id=? AND user_id=?), 
               status='confirmed'
           WHERE r.exam_id = ? AND r.student_id = ?`,
          [examId, studentId, examId, studentId]
        );
      } catch { }
    }

    // Return updated row
    try {
      const [rows] = await conn.query(
        `CALL sp_get_exam_results(?, 'instructor', ?);`,
        [examId, req.user?.id || 0]
      );
      conn.release();
      const data = Array.isArray(rows) ? rows : [];
      const row = data.find(
        (r) => Number(r.student_id) === Number(studentId)
      );
      return res.json(row || { ok: true });
    } catch {
      conn.release();
      return res.json({ ok: true });
    }
  } catch (err) {
    console.error("PUT score error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getExamResults = async (req, res) => {
  const { examId } = req.params;
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      `
      WITH RankedSubmissions AS (
        SELECT s.id AS submission_id, u.id AS student_id, u.full_name AS student_name,
               s.total_score AS mcq_score, s.total_score, s.ai_score, s.suggested_total_score,
               s.started_at, s.submitted_at,
               TIMESTAMPDIFF(MINUTE, s.started_at, s.submitted_at) AS duration_minutes,
               s.cheating_count,
               (CASE WHEN s.face_image_blob IS NOT NULL THEN 1 ELSE 0 END) AS has_face_image,
               (CASE WHEN s.student_card_blob IS NOT NULL THEN 1 ELSE 0 END) AS has_student_card,
               s.status,
               s.instructor_confirmed,
               ROW_NUMBER() OVER(
                 PARTITION BY s.user_id 
                 ORDER BY COALESCE(s.total_score, s.suggested_total_score, 0) DESC, s.id DESC
               ) as rn
        FROM submissions s
        JOIN users u ON s.user_id = u.id
        WHERE s.exam_id = ?
      )
      SELECT submission_id, student_id, student_name, mcq_score, total_score, ai_score, 
             suggested_total_score, started_at, submitted_at, duration_minutes, 
             cheating_count, has_face_image, has_student_card, status, instructor_confirmed
      FROM RankedSubmissions 
      WHERE rn = 1
      ORDER BY submitted_at DESC
    `,
      [examId]
    );
    conn.release();
    res.json(rows);
  } catch (err) {
    console.error("Error getting exam results:", err);
    res.status(500).json({ error: "Failed to get exam results" });
  }
};

// Reset cheating logs cho một submission (chỉ dùng cho testing/debugging)
exports.resetCheatingLogs = async (req, res) => {
  const submissionId = req.params.submissionId || req.params.id;

  if (!submissionId || isNaN(parseInt(submissionId))) {
    return res.status(400).json({ error: "Invalid submissionId" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Xóa tất cả cheating logs của submission này
    await conn.query("DELETE FROM cheating_logs WHERE submission_id = ?", [
      submissionId,
    ]);

    // Reset cheating_count về 0
    await conn.query("UPDATE submissions SET cheating_count = 0 WHERE id = ?", [
      submissionId,
    ]);

    await conn.commit();
    conn.release();

    console.log(
      `✅ [Reset] Cleared cheating logs for submission ${submissionId}`
    );
    res.json({
      success: true,
      message: `Cheating logs cleared for submission ${submissionId}`,
    });
  } catch (err) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error("❌ [Reset] Error clearing cheating logs:", err);
    res
      .status(500)
      .json({ error: "Failed to clear cheating logs", details: err.message });
  }
};

// Optional: Thêm endpoint delete student nếu cần (gọi sp_delete)
exports.deleteStudentExamRecord = async (req, res) => {
  const { examId, studentId } = req.params;
  try {
    const conn = await pool.getConnection();
    await conn.query("CALL sp_delete_student_exam_record(?, ?)", [
      examId,
      studentId,
    ]);
    conn.release();
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting student record:", err);
    res.status(500).json({ error: "Failed to delete student record" });
  }
};

exports.getSubmissionQuestions = async (req, res) => {
  const submissionId = req.params.submissionId || req.params.id;

  if (!submissionId || isNaN(parseInt(submissionId))) {
    return res.status(400).json({ error: "Invalid submissionId" });
  }

  try {
    const conn = await pool.getConnection();

    // Lấy exam_id, user_id và exam status từ submission
    const [subRows] = await conn.query(
      `SELECT s.exam_id, s.user_id, e.status as exam_status 
       FROM submissions s
       JOIN exams e ON e.id = s.exam_id
       WHERE s.id = ?`,
      [submissionId]
    );

    if (!subRows || subRows.length === 0) {
      conn.release();
      return res.status(404).json({ error: "Submission not found" });
    }

    const {
      exam_id: examId,
      user_id: studentId,
      exam_status: examStatus,
    } = subRows[0];

    // Nếu exam đã archived, lấy submission có điểm cao nhất của sinh viên này
    let actualSubmissionId = submissionId;

    if (examStatus === "archived") {
      const [bestSub] = await conn.query(
        `SELECT id FROM submissions
         WHERE exam_id = ? AND user_id = ?
         ORDER BY COALESCE(total_score, suggested_total_score, 0) DESC, id DESC
         LIMIT 1`,
        [examId, studentId]
      );

      if (bestSub && bestSub[0]) {
        actualSubmissionId = bestSub[0].id;
        console.log(
          `✅ [Submission] Exam archived - using best submission ${actualSubmissionId} instead of ${submissionId}`
        );
      }
    }

    // Lấy tất cả câu hỏi của bài thi (bao gồm model_answer cho Essay)
    const [questions] = await conn.query(
      `SELECT id as question_id, question_text, type, points, order_index, model_answer 
       FROM exam_questions 
       WHERE exam_id = ? 
       ORDER BY CASE WHEN type = 'MCQ' THEN 0 ELSE 1 END, COALESCE(order_index, 0) ASC, type DESC, id ASC`,
      [examId]
    );

    // Lấy tất cả options cho các câu MCQ
    const [options] = await conn.query(
      `SELECT eo.id as option_id, eo.question_id, eo.option_text, eo.is_correct
       FROM exam_options eo
       INNER JOIN exam_questions eq ON eo.question_id = eq.id
       WHERE eq.exam_id = ?
       ORDER BY eo.id ASC`,
      [examId]
    );

    // Lấy câu trả lời từ submission có điểm cao nhất
    const [answers] = await conn.query(
      `SELECT id, question_id, answer_text, selected_option_id, score, status
       FROM student_answers
       WHERE submission_id = ? AND student_id = ?`,
      [actualSubmissionId, studentId]
    );

    conn.release();

    res.json({
      questions,
      options,
      answers,
      exam_id: examId,
      student_id: studentId,
      submission_id: actualSubmissionId,
      original_submission_id: submissionId,
      is_best_submission: actualSubmissionId === parseInt(submissionId),
      exam_status: examStatus,
    });
  } catch (err) {
    console.error("❌ [Submission] Error fetching questions:", err);
    res.status(500).json({
      error: "Failed to fetch submission questions",
      details: err.message,
    });
  }
};
