const { pool } = require("../config/db");

const CHEATING_TYPES = {
  "blocked_key": "high",
  "visibility_hidden": "medium",
  "fullscreen_lost": "high",
  "window_blur": "medium",
  "tab_switch": "high",
  "alt_tab": "high",
  "multiple_faces": "high",
  "no_face_detected": "medium",
  "copy_paste": "high",
};

exports.postProctorEvent = async (req, res) => {
  const submissionId = req.params.submissionId || req.params.id; 
  const { event_type, details } = req.body;
  
  //console.log(`📝 [Proctor] Received event: ${event_type} for submission ${submissionId}`, { body: req.body });
  
  // Validate required fields
  if (!event_type) {
    //console.error("❌ [Proctor] Missing event_type");
    return res.status(400).json({ error: "event_type is required" });
  }
  
  if (!submissionId || isNaN(parseInt(submissionId))) {
    //console.error("❌ [Proctor] Invalid submissionId:", submissionId);
    return res.status(400).json({ error: "Invalid submissionId" });
  }
  
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    
    const severity = CHEATING_TYPES[event_type];
    const isCheating = !!severity;
    
    let updatedCheatingCount = null;
    
    if (isCheating) {
      // Get submission details (student_id, exam_id)
      const [subRows] = await conn.query(
        "SELECT user_id, exam_id FROM submissions WHERE id = ?",
        [submissionId]
      );
      
      if (subRows && subRows[0]) {
        const { user_id: studentId, exam_id: examId } = subRows[0];
        
        // Insert into cheating_logs table (trigger will auto-update cheating_count)
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
            severity
          ]
        );
        
        //console.log(`✅ [Proctor] Cheating logged with ID: ${insertResult.insertId}`);
        
        // Get updated count (trigger already updated submissions.cheating_count)
        const [countResult] = await conn.query(
          "SELECT cheating_count FROM submissions WHERE id = ?",
          [submissionId]
        );
        
        updatedCheatingCount = countResult[0]?.cheating_count || 0;
        
        //console.log(`📊 [Proctor] Current cheating_count: ${updatedCheatingCount}`);
      }
    } else {
      //console.log(`ℹ️ [Proctor] Non-cheating event: ${event_type}`);
    }
    
    await conn.commit();
    conn.release();
    
    res.status(200).json({
      success: true,
      is_cheating: isCheating,
      severity: severity || null,
      cheating_count: updatedCheatingCount,
      message: isCheating ? `Cheating event logged: ${event_type}` : `Event logged: ${event_type}`
    });
  } catch (err) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error("❌ [Proctor] Error logging event:", err);
    res.status(500).json({ error: "Failed to log proctor event", details: err.message });
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
      summary: summary[0] || {}
    });
  } catch (err) {
    console.error("Error getting cheating details:", err);
    res.status(500).json({ error: "Failed to get cheating details" });
  }
};

exports.approveStudentScores = async (req, res) => {
  const { examId, studentId } = req.params;
  const { mcq_score, ai_score, total_score, per_question_scores } = req.body;
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    if (total_score != null) {
      await conn.query("CALL sp_update_student_exam_record(?, ?, ?, ?, ?)", [
        examId,
        studentId,
        null,
        mcq_score,
        ai_score,
      ]);
    }

    if (per_question_scores && per_question_scores.length > 0) {
      for (const { question_id, score } of per_question_scores) {
        await conn.query(
          `
          UPDATE student_answers sa
          JOIN submissions s ON sa.submission_id = s.id
          SET sa.score = ?, sa.status = 'confirmed', sa.graded_at = NOW()
          WHERE s.exam_id = ? AND s.user_id = ? AND sa.question_id = ?
        `,
          [score, examId, studentId, question_id]
        );
      }
    }

    await conn.commit();
    conn.release();
    res.json({ success: true });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error approving scores:", err);
    res.status(500).json({ error: "Failed to approve scores" });
  }
};

exports.getExamResults = async (req, res) => {
  const { examId } = req.params;
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      `
      SELECT s.id AS submission_id, u.id AS student_id, u.full_name AS student_name,
             s.mcq_score, s.ai_score, s.suggested_total_score,
             s.started_at, s.submitted_at, s.duration_minutes, s.cheating_count,
             s.face_card_id, s.card_number, s.status
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.exam_id = ?
      ORDER BY s.submitted_at DESC
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
