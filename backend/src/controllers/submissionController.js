const { pool } = require("../config/db");
const { getIsRedisEnabled, pubClient } = require("../config/redis");
const { broadcastCheatingEvent } = require("../services/socketService");
const axios = require("axios");

const CHEATING_TYPES = {
  // === Updated Precise Events ===
  copy_attempt: "high",
  paste_attempt: "high",
  drag_drop_in: "high",
  screenshot_attempt: "high",
  blocked_key: "high",
  visibility_hidden: "medium",
  fullscreen_lost: "high",
  window_blur: "medium",
  tab_switch: "high",
  alt_tab: "high",
  multiple_faces: "high",
  no_face_detected: "medium",
  inactivity: "low",
  split_screen: "medium",
  ai_detected_cheating: "high",
  devtools_attempt: "high",
  multi_monitor_attempt: "medium",
  mouse_outside: "low",
  typing_speed_violation: "medium",
  screen_share_stopped: "high",
  prolonged_away: "high",
  minimize_app: "high",
  hide_app: "high",
  app_switching: "high",

  // === Legacy Events (Kept for backwards compatibility) ===
  copy: "high",
  paste: "high",
  drag_drop_attempt: "high",
  fullscreen_exit_attempt: "high",
  copy_paste: "high"
};

const SHARED_FOCUS_EVENTS = ["visibility_hidden", "window_blur", "fullscreen_lost", "split_screen"];
const SHARED_FOCUS_WINDOW = 3000;

// === LOG BUFFERING SYSTEM ===
// Purpose: Accumulate logs and bulk-insert every 5s to reduce DB IOPS by 90%+
class ProctorLogBuffer {
  constructor(flushInterval = 5000, maxBufferSize = 200) {
    this.buffer = [];
    this.flushInterval = flushInterval;
    this.maxBufferSize = maxBufferSize;
    this.timer = null;
    this._startTimer();
  }

  add(log) {
    this.buffer.push(log);
    if (this.buffer.length >= this.maxBufferSize) {
      console.log(`🚀 [LogBuffer] Buffer limit reached (${this.buffer.length}), flushing immediately...`);
      this.flush();
    }
  }

  _startTimer() {
    this.timer = setInterval(() => this.flush(), this.flushInterval);
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const logsToInsert = [...this.buffer];
    this.buffer = []; // Clear buffer immediately to prevent duplicates

    console.log(`💾 [LogBuffer] Flushing ${logsToInsert.length} logs to database...`);

    let conn;
    try {
      conn = await pool.getConnection();
      // Bulk Insert Syntax: INSERT INTO table (cols) VALUES (row1), (row2), ...
      const values = logsToInsert.map(log => [
        log.submissionId,
        log.studentId,
        log.examId,
        log.event_type,
        JSON.stringify(log.details || {}),
        log.severity,
        log.detected_at || new Date()
      ]);

      const sql = `INSERT INTO cheating_logs 
                   (submission_id, student_id, exam_id, event_type, event_details, severity, detected_at) 
                   VALUES ?`;

      await conn.query(sql, [values]);

      console.log(`✅ [LogBuffer] Successfully persisted ${logsToInsert.length} logs.`);
    } catch (err) {
      console.error("❌ [LogBuffer] Error flushing logs, saving to Redis for retry:", err.message);

      // PERSISTENCE FALLBACK: Push failed logs to Redis queue
      if (getIsRedisEnabled()) {
        try {
          // Flatten if needed or push as batch
          await pubClient.lpush("oem:failed_proctor_logs", JSON.stringify(logsToInsert));
          console.log(`📦 [LogBuffer] Stored ${logsToInsert.length} logs in Redis retry queue.`);
        } catch (redisErr) {
          console.error("🔥 [LogBuffer] FATAL: Redis fallback failed:", redisErr.message);
        }
      }
    } finally {
      if (conn) conn.release();
    }
  }
}

const proctorBuffer = new ProctorLogBuffer();

// Background worker to retry failed logs from Redis every 30 seconds
if (getIsRedisEnabled()) {
  setInterval(async () => {
    try {
      const failedBatch = await pubClient.rpop("oem:failed_proctor_logs");
      if (failedBatch) {
        const logs = JSON.parse(failedBatch);
        console.log(`🔄 [LogRetry] Attempting to re-flush ${logs.length} failed logs from Redis...`);

        // Re-inject into buffer for processing
        logs.forEach(log => proctorBuffer.add(log));
      }
    } catch (err) {
      console.error("⚠️ [LogRetry] Error in retry worker:", err.message);
    }
  }, 30000);
}

const DEDUP_WINDOW = 3000;
const recentEvents = new Map();

exports.postProctorEvent = async (req, res) => {
  const submissionId = req.params.submissionId || req.params.id;
  const { event_type, details, cheating_count: reqCheatingCount } = req.body;

  // Validate required fields
  if (!event_type) {
    console.error("❌ [Proctor] Missing event_type");
    return res.status(400).json({ error: "event_type is required" });
  }

  if (!submissionId || isNaN(parseInt(submissionId))) {
    console.error("❌ [Proctor] Invalid submissionId:", submissionId);
    return res.status(400).json({ error: "Invalid submissionId" });
  }

  const now = Date.now();
  const eventKey = `${submissionId}-${event_type}`;
  const lastEventTime = recentEvents.get(eventKey);

  // Debounce duplicate events within 1 second
  if (lastEventTime && (now - lastEventTime < 1000)) {
    console.warn(`[Proctor] Same event debounced within 1s: ${eventKey}`);
    return res.status(200).json({
      success: true,
      message: "Same event debounced within 1s"
    });
  }

  recentEvents.set(eventKey, now);

  if (recentEvents.size > 1000) {
    const cutoff = now - 60 * 60 * 1000;
    for (const [key, time] of recentEvents.entries()) {
      if (time < cutoff) recentEvents.delete(key);
    }
  }

  try {
    // 1. IMMEDIATE BROADCAST: Inform instructor instantly via Socket.io
    let severity = CHEATING_TYPES[event_type] || "high";
    if (!severity && event_type.startsWith("ai_")) severity = "high";
    const isCheating = true;

    const [subRows] = await pool.query(
      `SELECT s.user_id, s.exam_id, s.cheating_count, u.full_name as student_name 
       FROM submissions s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.id = ? LIMIT 1`,
      [submissionId]
    );

    if (subRows && subRows[0]) {
      studentId = subRows[0].user_id;
      examId = subRows[0].exam_id;
      const studentName = subRows[0].student_name || `Student ${studentId}`;
      // Lấy số lượng vi phạm thực tế từ bảng logs
      const [countRow] = await pool.query(
        "SELECT COUNT(*) as cnt FROM cheating_logs WHERE submission_id = ? AND event_type != 'admin_bypass'",
        [submissionId]
      );
      const currentCount = reqCheatingCount !== undefined ? parseInt(reqCheatingCount) : (countRow[0]?.cnt || 0) + 1;

      // Broadcast immediately
      broadcastCheatingEvent(examId, {
        submissionId: parseInt(submissionId),
        studentId: parseInt(studentId),
        studentName: studentName,
        eventType: event_type,
        severity: severity || "low",
        detectedAt: new Date(),
        eventDetails: details || {},
        cheatingCount: currentCount,
      });

      // 1.5 Send FCM push notification to the instructor of this exam if they are registered with fcm_token
      try {
        const [examRows] = await pool.query(
          `SELECT e.instructor_id, u.fcm_token 
           FROM exams e
           LEFT JOIN users u ON u.id = e.instructor_id
           WHERE e.id = ? LIMIT 1`,
          [examId]
        );
        if (examRows && examRows[0] && examRows[0].fcm_token) {
          const { sendPushNotification } = require("../services/fcmService");
          const eventDict = {
            'alt_tab': "Chuyển ứng dụng (Alt+Tab)",
            'visibility_hidden': "Ẩn hoặc đổi tab bài thi",
            'window_blur': "Rời khỏi vùng làm bài (Mất Focus)",
            'fullscreen_lost': "Thoát chế độ toàn màn hình",
            'split_screen': "Sử dụng chia đôi màn hình",
            'multi_monitor_attempt': "Sử dụng nhiều màn hình",
            'screenshot_attempt': "Cố tình chụp màn hình",
            'screen_record_attempt': "Cố tình quay video màn hình",
            'screen_share_attempt': "Cố tình chia sẻ màn hình",
            'minimize_app': "Thoát ứng dụng về màn hình Home",
            'idle_timeout': "Treo máy không tương tác quá 1 phút",
            'blocked_key': "Sử dụng phím tắt bị cấm",
            'inactivity': "Không hoạt động trong thời gian dài",
            'blur_event': "Chuyển tab / Rời màn hình",
            'paste_attempt': "Thao tác dán nội dung",
            'copy_attempt': "Thao tác sao chép nội dung",
            'drag_drop_in': "Kéo thả tài liệu từ ngoài vào",
            'drag_drop_attempt': "Kéo thả tài liệu",
            'tab_switch': "Liên tục đổi tab bài thi",
            'multiple_faces': "Phát hiện có người lạ trong camera",
            'no_face': "Không thấy thí sinh trước camera",
            'no_face_detected': "Không phát hiện khuôn mặt",
            'ai_detected_cheating': "Tổng hợp hành vi đáng ngờ (AI phân tích)",
            'devtools_attempt': "Mở công cụ phát triển (DevTools)",
            'mouse_outside': "Chuột rời khỏi vùng làm bài",
            'typing_speed_violation': "Tốc độ gõ phím bất thường (Dùng Tool)",
            'screen_share_stopped': "Ngắt chia sẻ màn hình giám sát",
            'prolonged_away': "Vắng mặt quá lâu (>15 giây)",
            'win_d_attempt': "Sử dụng Win+D ẩn màn hình nhanh",
            'win_d': "Sử dụng Win+D ẩn màn hình nhanh",
            'multi_monitor': "Sử dụng nhiều màn hình",
          };
          const readableEvent = eventDict[event_type] || event_type || "Hành vi đáng ngờ";
          sendPushNotification(
            examRows[0].fcm_token,
            `🚨 GIAN LẬN - ${studentName}`,
            `🔴 ${readableEvent}`,
            {
              submissionId: String(submissionId),
              examId: String(examId)
            }
          ).catch(err => console.error("⚠️ [FCM] Error pushing notification:", err.message));
        }
      } catch (fcmErr) {
        console.error("⚠️ [FCM] Error checking instructor fcm_token:", fcmErr.message);
      }

      // 2. IMMEDIATE PERSISTENCE: Insert directly into DB for instant teacher access
      let actualCount = currentCount;
      if (isCheating) {
        await pool.query(
          `INSERT INTO cheating_logs 
           (submission_id, student_id, exam_id, event_type, event_details, severity, detected_at) 
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [
            submissionId,
            studentId,
            examId,
            event_type,
            JSON.stringify(details || {}),
            severity || "low"
          ]
        );

        // Force sync cheating_count with actual count in cheating_logs
        const [cntRows] = await pool.query(
          "SELECT COUNT(*) as cnt FROM cheating_logs WHERE submission_id = ? AND event_type != 'admin_bypass'",
          [submissionId]
        );
        actualCount = cntRows[0]?.cnt || 0;
        await pool.query(
          "UPDATE submissions SET cheating_count = ? WHERE id = ?",
          [actualCount, submissionId]
        );
      }

      // ── AUTO SUBMIT EXAM ON BACKEND IF >= 10 VIOLATIONS ──
      if (actualCount >= 10) {
        console.log(`⚠️ [Proctor] Auto submitting exam because count is ${actualCount}/10`);
        
        const [mcqRows] = await pool.query(
          `SELECT q.id AS question_id, q.points,
                  o.id AS option_id, o.is_correct,
                  a.selected_option_id
           FROM exam_questions q
           LEFT JOIN exam_options o ON o.question_id = q.id AND o.is_correct = TRUE
           LEFT JOIN student_answers a ON a.question_id = q.id AND a.submission_id = ?
           WHERE q.exam_id = ? AND q.type = 'MCQ'`,
          [submissionId, examId]
        );

        let totalScore = 0;
        if (Array.isArray(mcqRows)) {
          mcqRows.forEach((r) => {
            if (
              r.selected_option_id &&
              r.option_id &&
              r.selected_option_id === r.option_id
            ) {
              totalScore += Number(r.points || 0);
            }
          });
        }

        await pool.query(
          `UPDATE submissions 
           SET total_score = ?, suggested_total_score = total_score + COALESCE(ai_score,0), status='graded', submitted_at = NOW() 
           WHERE id = ? AND submitted_at IS NULL`,
          [totalScore, submissionId]
        );

        try {
          const { gradeSubmission } = require("../../services/AIService");
          if (typeof gradeSubmission === "function") {
            gradeSubmission(submissionId).catch(e => console.warn("Failed to queue AI grading:", e.message));
          }
        } catch (e) {
          /* ignore */
        }

        try {
          const { broadcastSubmissionFinished } = require("../services/socketService");
          broadcastSubmissionFinished(examId, submissionId, studentId);
        } catch (e) {
          /* ignore */
        }
      }
    }

    // Query actual updated cheating_count from DB after trigger fires
    let finalCheatingCount = reqCheatingCount !== undefined ? parseInt(reqCheatingCount) : 0;
    if (reqCheatingCount === undefined && isCheating) {
      const [updatedSubRows] = await pool.query(
        `SELECT cheating_count FROM submissions WHERE id = ? LIMIT 1`,
        [submissionId]
      );
      finalCheatingCount = updatedSubRows[0]?.cheating_count || 0;
    } else if (reqCheatingCount === undefined) {
      finalCheatingCount = subRows[0]?.cheating_count || 0;
    }

    res.status(200).json({
      success: true,
      is_cheating: isCheating,
      cheating_count: finalCheatingCount,
      message: `Event processed (Buffered Persistence)`
    });
  } catch (err) {
    console.error("❌ [Proctor] Error logging event:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteProctorEvent = async (req, res) => {
  const { submissionId, snapshotId } = req.params;

  if (!submissionId || !snapshotId) {
    return res.status(400).json({ error: "Missing submissionId or snapshotId" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    // Tìm record log dựa vào snapshot_id trong JSON event_details
    const [logs] = await conn.query(
      `SELECT id FROM cheating_logs WHERE submission_id = ? AND event_details LIKE ? LIMIT 1`,
      [submissionId, `%${snapshotId}%`]
    );

    if (logs.length > 0) {
      const logId = logs[0].id;
      // Trừ cheating_count
      await conn.query(
        `UPDATE submissions 
         SET cheating_count = GREATEST(0, cheating_count - 1) 
         WHERE id = ?`,
        [submissionId]
      );

      // Xóa log
      await conn.query(`DELETE FROM cheating_logs WHERE id = ?`, [logId]);

      console.log(`[Proctor] 🗑️ Removed false positive cheating log (ID: ${logId}) for snapshot: ${snapshotId}`);
    }

    conn.release();

    // Call snapshotController to delete physical files
    try {
      const path = require('path');
      const fs = require('fs');
      const SNAPSHOTS_DIR = path.join(__dirname, '../../uploads/snapshots');
      const VIDEOS_DIR = path.join(__dirname, '../../uploads/videos');

      const violationDir = path.join(SNAPSHOTS_DIR, String(submissionId), String(snapshotId));
      if (fs.existsSync(violationDir)) {
        fs.rmSync(violationDir, { recursive: true, force: true });
      }

      const videoName = `submission_${submissionId}_violation_${snapshotId}.mp4`;
      const videoPath = path.join(VIDEOS_DIR, videoName);
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    } catch (e) {
      console.warn("Failed to delete physical evidence:", e.message);
    }

    res.status(200).json({ success: true, message: "False positive event deleted" });
  } catch (error) {
    if (conn) conn.release();
    console.error("❌ [Proctor] Delete event error:", error);
    res.status(500).json({ error: "Internal server error" });
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
    // 1. Lấy danh sách logs chi tiết
    const [cheatingLogs] = await conn.query(
      `SELECT 
        cl.id,
        cl.event_type,
        cl.event_details,
        cl.detected_at,
        cl.severity,
        COALESCE(u.full_name, 'Thí sinh không xác định') AS student_name,
        COALESCE(e.title, 'Đề thi không xác định') AS exam_title
       FROM cheating_logs cl
       LEFT JOIN submissions s ON s.id = cl.submission_id
       LEFT JOIN users u ON u.id = cl.student_id
       LEFT JOIN exams e ON e.id = cl.exam_id
       WHERE cl.submission_id = ? AND cl.event_type != 'admin_bypass'
       ORDER BY cl.detected_at DESC`,
      [submissionId]
    );

    // 2. Lấy thống kê tổng quát dựa TRÊN CÙNG danh sách trên
    const [summary] = await conn.query(
      `SELECT 
        COUNT(*) AS total_incidents,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) AS high_count,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) AS medium_count,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) AS low_count,
        MIN(detected_at) AS first_incident,
        MAX(detected_at) AS last_incident
       FROM cheating_logs
       WHERE submission_id = ? AND event_type != 'admin_bypass'`,
      [submissionId]
    );

    const totalFromLogs = summary[0]?.total_incidents || 0;

    // 3. TỰ ĐỘNG SYNC: Nếu cheating_count trong submissions bị sai lệch, cập nhật lại ngay
    const [subCheck] = await conn.query(
      "SELECT cheating_count FROM submissions WHERE id = ? LIMIT 1",
      [submissionId]
    );

    if (subCheck.length > 0 && totalFromLogs !== subCheck[0].cheating_count) {
      console.log(`🔄 [Sync] Correcting cheating_count for submission ${submissionId}: ${subCheck[0].cheating_count} -> ${totalFromLogs}`);
      await conn.query(
        "UPDATE submissions SET cheating_count = ? WHERE id = ?",
        [totalFromLogs, submissionId]
      );
    }

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
      // 1. Fetch all current answers for this student/exam in one go
      if (per_question_scores && Array.isArray(per_question_scores)) {
        const questionIds = per_question_scores.map(p => p.question_id);
        const [qRows] = await conn.query(
          `SELECT sa.question_id, sa.answer_text, q.model_answer, q.points, sa.score as old_score, q.type, sa.submission_id
           FROM student_answers sa
           JOIN exam_questions q ON sa.question_id = q.id
           JOIN submissions sub ON sa.submission_id = sub.id
           WHERE sa.question_id IN (?) AND sub.user_id = ? AND sub.exam_id = ?`,
          [questionIds, studentId, examId]
        );

        const qMap = new Map(qRows.map(r => [r.question_id, r]));

        for (const p of per_question_scores) {
          const qid = p.question_id;
          const newScore = p.score;
          const qInfo = qMap.get(qid);

          if (qInfo) {
            await conn.query(
              `UPDATE student_answers SET score = ? WHERE question_id = ? AND submission_id = ?`,
              [newScore, qid, qInfo.submission_id]
            );

            // Gửi dữ liệu training cho AI (Bất đồng bộ - Fire and Forget)
            if (qInfo.type === 'Essay' && parseFloat(newScore) !== parseFloat(qInfo.old_score)) {
              const aiUrl = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
              axios.post(`${aiUrl}/learn/from-correction`, {
                student_answer: qInfo.answer_text,
                model_answer: qInfo.model_answer,
                old_score: parseFloat(qInfo.old_score || 0),
                new_score: parseFloat(newScore),
                max_points: parseFloat(qInfo.points),
                feedback: "Sửa bài bởi giảng viên"
              }, { timeout: 3000 }).catch(e => console.log(`[AI Learning] ⚠️ Error:`, e.message));
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

    // 1. Lấy câu trả lời từ submission
    const [answers] = await conn.query(
      `SELECT sa.* FROM student_answers sa WHERE sa.submission_id = ?`,
      [actualSubmissionId]
    );

    // 2. Lấy AI logs mới nhất để bổ sung Reasoning
    try {
      const [aiLogs] = await conn.query(
        `SELECT question_id, response_payload FROM ai_logs 
         WHERE student_id = ? AND question_id IN (
           SELECT question_id FROM student_answers WHERE submission_id = ?
         )
         ORDER BY created_at DESC`,
        [studentId, actualSubmissionId]
      );

      const latestLogsMap = {};
      (aiLogs || []).forEach(log => {
        if (!latestLogsMap[log.question_id]) {
          latestLogsMap[log.question_id] = log.response_payload;
        }
      });

      // Merge reasoning vào answers
      answers.forEach(ans => {
        if (!ans.ai_explanation && latestLogsMap[ans.question_id]) {
          ans.ai_explanation = latestLogsMap[ans.question_id];
        }
      });
    } catch (logErr) {
      console.warn("⚠️ [Submission] Could not fetch ai_logs fallback:", logErr.message);
    }

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
