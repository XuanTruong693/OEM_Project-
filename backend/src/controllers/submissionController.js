const pool = require("../config/db");

const CHEATING_TYPES = new Set([
  "blocked_key",
  "visibility_hidden",
  "fullscreen_lost",
  "window_blur",
  "tab_switch",
  "alt_tab",
]);

exports.postProctorEvent = async (req, res) => {
  const { submissionId } = req.params;
  const { event_type, details } = req.body;
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const isCheating = CHEATING_TYPES.has(event_type) ? 1 : 0;
    const [insertResult] = await conn.query(
      "INSERT INTO proctor_events (submission_id, event_type, details, is_cheating) VALUES (?, ?, ?, ?)",
      [submissionId, event_type, JSON.stringify(details || {}), isCheating]
    );
    let updatedCheatingCount = null;
    if (isCheating) {
      // Increment count
      await conn.query(
        "UPDATE submissions SET cheating_count = cheating_count + 1, cheating_flag = 1 WHERE id = ?",
        [submissionId]
      );
      const [rows] = await conn.query(
        "SELECT cheating_count FROM submissions WHERE id = ?",
        [submissionId]
      );
      if (rows && rows[0]) updatedCheatingCount = rows[0].cheating_count;
    }
    await conn.commit();
    conn.release();
    res.status(200).json({
      success: true,
      event_id: insertResult.insertId,
      is_cheating: !!isCheating,
      cheating_count: updatedCheatingCount,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error logging proctor event:", err);
    res.status(500).json({ error: "Failed to log proctor event" });
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
