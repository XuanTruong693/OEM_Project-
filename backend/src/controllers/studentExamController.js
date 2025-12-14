const jwt = require("jsonwebtoken");
const sequelize = require("../config/db");
const fs = require("fs");
const path = require("path");
const { gradeSubmission } = require("../services/AIService");

// Helper: sign a short-lived room token
function signRoomToken(payload, ttlSeconds = 15 * 60) {
  const secret = process.env.JWT_SECRET || "dev_secret";
  return jwt.sign(payload, secret, { expiresIn: ttlSeconds });
}

function verifyRoomToken(token) {
  const secret = process.env.JWT_SECRET || "dev_secret";
  try {
    return jwt.verify(token, secret);
  } catch (e) {
    return null;
  }
}
async function hasColumn(table, column) {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    { replacements: [table, column] }
  );
  return Array.isArray(rows) && rows.length > 0;
}

// POST /api/exams/verify-room
async function verifyRoom(req, res) {
  try {
    const { room_code } = req.body || {};
    console.log('🔍 [verifyRoom] Received room_code:', room_code, 'Length:', room_code?.length);

    if (!room_code)
      return res.status(400).json({ message: "room_code is required" });

    // Trim room code để tránh lỗi do khoảng trắng
    const trimmedCode = String(room_code).trim();
    console.log('🔍 [verifyRoom] Trimmed room_code:', trimmedCode, 'Length:', trimmedCode.length);

    // Check exam exists and is published
    const base = await sequelize.query(
      `SELECT id, exam_room_code, status, duration FROM exams WHERE exam_room_code = ? AND status = 'published' LIMIT 1`,
      { replacements: [trimmedCode] }
    );
    const [rows] = base;
    console.log('📊 [verifyRoom] Query result:', rows);

    const exam = Array.isArray(rows) ? rows[0] : rows;
    if (!exam) {
      console.log('❌ [verifyRoom] Exam not found or not published for code:', trimmedCode);
      // Kiểm tra xem exam có tồn tại không (bất kể status)
      const [allRows] = await sequelize.query(
        `SELECT id, exam_room_code, status FROM exams WHERE exam_room_code = ? LIMIT 1`,
        { replacements: [trimmedCode] }
      );
      console.log('🔎 [verifyRoom] Check all statuses:', allRows);

      return res
        .status(404)
        .json({ message: "Mã không đúng hoặc phòng chưa mở" });
    }

    console.log('✅ [verifyRoom] Found exam:', exam.id, 'Status:', exam.status);

    // Kiểm tra số lần thi (nếu user đã đăng nhập)
    if (req.user && req.user.id) {
      const userId = req.user.id;

      // Lấy max_attempts từ exam
      const [examSettings] = await sequelize.query(
        `SELECT max_attempts FROM exams WHERE id = ? LIMIT 1`,
        { replacements: [exam.id] }
      );
      const maxAttempts = examSettings[0]?.max_attempts || 0;

      // Nếu max_attempts > 0, kiểm tra số lần đã thi
      if (maxAttempts > 0) {
        const [attemptCount] = await sequelize.query(
          `SELECT COUNT(*) as attempt_count FROM submissions WHERE exam_id = ? AND user_id = ?`,
          { replacements: [exam.id, userId] }
        );
        const currentAttempts = attemptCount[0]?.attempt_count || 0;

        if (currentAttempts >= maxAttempts) {
          return res.status(403).json({
            message: `Bạn đã hết lượt thi. Số lần thi tối đa: ${maxAttempts}`,
            max_attempts: maxAttempts,
            current_attempts: currentAttempts,
            reason: "max_attempts_exceeded"
          });
        }
      }
    }

    // Optional columns
    const [hasDurMin, hasOpen, hasClose, hasFace, hasCard, hasMonitor, hasMax] =
      await Promise.all([
        hasColumn("exams", "duration_minutes"),
        hasColumn("exams", "time_open"),
        hasColumn("exams", "time_close"),
        hasColumn("exams", "require_face_check"),
        hasColumn("exams", "require_student_card"),
        hasColumn("exams", "monitor_screen"),
        hasColumn("exams", "max_points"),
      ]);

    let extra = {};
    if (
      hasDurMin ||
      hasOpen ||
      hasClose ||
      hasFace ||
      hasCard ||
      hasMonitor ||
      hasMax
    ) {
      const cols = [
        hasDurMin ? "duration_minutes" : null,
        hasOpen ? "time_open" : null,
        hasClose ? "time_close" : null,
        hasFace ? "require_face_check" : null,
        hasCard ? "require_student_card" : null,
        hasMonitor ? "monitor_screen" : null,
        hasMax ? "max_points" : null,
      ]
        .filter(Boolean)
        .join(", ");
      if (cols.length > 0) {
        const [erows] = await sequelize.query(
          `SELECT ${cols} FROM exams WHERE id = ? LIMIT 1`,
          { replacements: [exam.id] }
        );
        extra = Array.isArray(erows) ? erows[0] : erows || {};
      }
    }

    // time window check, if available (chuẩn hoá timezone theo ENV để tránh lệch TZ giữa DB và cột lưu)
    if (extra.time_open || extra.time_close) {
      const tz = process.env.APP_TZ || "+07:00";
      const [checkRows] = await sequelize.query(
        `SELECT 
            CONVERT_TZ(NOW(), @@session.time_zone, ?) AS now_ts,
            ?                                        AS open_ts,
            ?                                        AS close_ts,
            (CASE WHEN ? IS NOT NULL AND CONVERT_TZ(NOW(), @@session.time_zone, ?) < ? THEN 1 ELSE 0 END) AS before_open,
            (CASE WHEN ? IS NOT NULL AND CONVERT_TZ(NOW(), @@session.time_zone, ?) > ? THEN 1 ELSE 0 END) AS after_close
         `,
        {
          replacements: [
            tz,
            extra.time_open || null,
            extra.time_close || null,
            extra.time_open || null,
            tz,
            extra.time_open || null,
            extra.time_close || null,
            tz,
            extra.time_close || null,
          ],
        }
      );
      const tw = Array.isArray(checkRows) ? checkRows[0] : checkRows;
      if (tw && Number(tw.before_open) === 1) {
        return res.status(403).json({
          message: "Chưa đến giờ mở phòng",
          now: tw.now_ts,
          time_open: tw.open_ts,
          time_close: tw.close_ts,
          reason: "before_open",
        });
      }
      if (tw && Number(tw.after_close) === 1) {
        return res.status(403).json({
          message: "Đã hết giờ làm bài",
          now: tw.now_ts,
          time_open: tw.open_ts,
          time_close: tw.close_ts,
          reason: "after_close",
        });
      }
    }

    const durationMinutes = extra.duration_minutes || exam.duration || 60;
    const flags = {
      require_face_check: !!extra.require_face_check,
      require_student_card: !!extra.require_student_card,
      monitor_screen: !!extra.monitor_screen,
      max_points: extra.max_points || null,
    };

    const room_token = signRoomToken({ exam_id: exam.id, room_code });
    return res.json({
      exam_id: exam.id,
      duration_minutes: durationMinutes,
      ...flags,
      room_token,
      time_open: extra.time_open || null,
      time_close: extra.time_close || null,
    });
  } catch (err) {
    console.error("verifyRoom error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// POST /api/exams/join (auth)
async function joinExam(req, res) {
  try {
    const { room_token } = req.body || {};
    if (!room_token)
      return res.status(400).json({ message: "room_token is required" });

    const claims = verifyRoomToken(room_token);
    if (!claims)
      return res.status(401).json({ message: "room_token invalid or expired" });

    const userId = req.user.id;
    const { exam_id, room_code } = claims;

    // Validate exam still valid
    const [rows] = await sequelize.query(
      `SELECT id, exam_room_code, status, duration, max_attempts
       FROM exams
       WHERE id = ? AND exam_room_code = ? AND status = 'published'`,
      { replacements: [exam_id, room_code] }
    );
    const exam = Array.isArray(rows) ? rows[0] : rows;
    if (!exam) return res.status(404).json({ message: "Exam not available" });

    // Kiểm tra lại số lần thi (phòng bypass)
    const maxAttempts = exam.max_attempts || 0;
    if (maxAttempts > 0) {
      const [attemptCount] = await sequelize.query(
        `SELECT COUNT(*) as attempt_count FROM submissions WHERE exam_id = ? AND user_id = ?`,
        { replacements: [exam_id, userId] }
      );
      const currentAttempts = attemptCount[0]?.attempt_count || 0;

      if (currentAttempts >= maxAttempts) {
        return res.status(403).json({
          message: `Bạn đã hết lượt thi. Số lần thi tối đa: ${maxAttempts}`,
          max_attempts: maxAttempts,
          current_attempts: currentAttempts,
          reason: "max_attempts_exceeded"
        });
      }
    }

    // Record verified room (if table exists)
    try {
      await sequelize.query(
        `INSERT IGNORE INTO user_verified_rooms(user_id, exam_room_code, verified_at)
         VALUES (?, ?, NOW())`,
        { replacements: [userId, room_code] }
      );
    } catch (e) { }

    const [maxAttempt] = await sequelize.query(
      `SELECT COALESCE(MAX(attempt_no), 0) AS max_attempt 
       FROM submissions 
       WHERE exam_id = ? AND user_id = ?`,
      { replacements: [exam_id, userId] }
    );

    const nextAttempt = (maxAttempt[0]?.max_attempt || 0) + 1;

    // Tạo submission mới cho lần thi này
    const [ins] = await sequelize.query(
      `INSERT INTO submissions (exam_id, user_id, status, attempt_no, submitted_at, cheating_count) 
       VALUES (?, ?, 'pending', ?, NULL, 0)`,
      { replacements: [exam_id, userId, nextAttempt] }
    );
    const submissionId = ins?.insertId || ins;

    console.log(
      `✅ [joinExam] Created new submission ${submissionId} for user ${userId}, exam ${exam_id}, attempt ${nextAttempt}`
    );

    // load flags from exams if available
    let flags = { face: false, card: false, monitor: false };
    try {
      const [hasFace, hasCard, hasMonitor] = await Promise.all([
        hasColumn("exams", "require_face_check"),
        hasColumn("exams", "require_student_card"),
        hasColumn("exams", "monitor_screen"),
      ]);
      if (hasFace || hasCard || hasMonitor) {
        const cols = [
          hasFace ? "require_face_check" : null,
          hasCard ? "require_student_card" : null,
          hasMonitor ? "monitor_screen" : null,
        ]
          .filter(Boolean)
          .join(", ");
        const [frows] = await sequelize.query(
          `SELECT ${cols} FROM exams WHERE id = ? LIMIT 1`,
          { replacements: [exam_id] }
        );
        const er = Array.isArray(frows) ? frows[0] : frows || {};
        flags = {
          face: !!er.require_face_check,
          card: !!er.require_student_card,
          monitor: !!er.monitor_screen,
        };
      }
    } catch (e) {
      /* ignore */
    }

    return res.json({
      exam_id,
      submission_id: submissionId,
      attempt_no: nextAttempt,
      flags,
    });
  } catch (err) {
    console.error("joinExam error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// POST /api/submissions/:id/upload-images (auth, multipart) - Chỉ upload, chưa verify
async function uploadImages(req, res) {
  try {
    const submissionId = req.params.id;
    const userId = req.user.id;

    const [subRows] = await sequelize.query(
      `SELECT id FROM submissions WHERE id = ? AND user_id = ? LIMIT 1`,
      { replacements: [submissionId, userId] }
    );
    if (!Array.isArray(subRows) || subRows.length === 0) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const faceFile =
      req.files && req.files["face_image"] && req.files["face_image"][0];
    const cardFile =
      req.files &&
      req.files["student_card_image"] &&
      req.files["student_card_image"][0];

    const response = { ok: true };

    // Lưu ảnh vào database (blob hoặc file)
    const hasCol = async (table, col) => {
      const [rows] = await sequelize.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
        { replacements: [table, col] }
      );
      return Array.isArray(rows) && rows.length > 0;
    };

    try {
      if (faceFile) {
        const hasBlob = await hasCol("submissions", "face_image_blob");
        const hasMime = await hasCol("submissions", "face_image_mimetype");
        if (hasBlob && hasMime) {
          await sequelize.query(
            `UPDATE submissions SET face_image_blob = ?, face_image_mimetype = ? WHERE id = ?`,
            {
              replacements: [
                faceFile.buffer,
                faceFile.mimetype || null,
                submissionId,
              ],
            }
          );
          response.face_uploaded = true;
          response.face_preview = `data:${faceFile.mimetype
            };base64,${faceFile.buffer.toString("base64")}`;
        }
      }

      if (cardFile) {
        const hasBlob = await hasCol("submissions", "student_card_blob");
        const hasMime = await hasCol("submissions", "student_card_mimetype");
        if (hasBlob && hasMime) {
          await sequelize.query(
            `UPDATE submissions SET student_card_blob = ?, student_card_mimetype = ? WHERE id = ?`,
            {
              replacements: [
                cardFile.buffer,
                cardFile.mimetype || null,
                submissionId,
              ],
            }
          );
          response.card_uploaded = true;
          response.card_preview = `data:${cardFile.mimetype
            };base64,${cardFile.buffer.toString("base64")}`;
        }
      }
    } catch (persistErr) {
      console.error("[uploadImages] persist error:", persistErr);
      return res.status(500).json({ message: "Failed to save images" });
    }

    return res.json(response);
  } catch (err) {
    console.error("uploadImages error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// POST /api/submissions/:id/verify-card (auth) - Xác minh thẻ SV đã upload
async function verifyStudentCardImage(req, res) {
  try {
    const submissionId = req.params.id;
    const userId = req.user.id;

    // Lấy ảnh thẻ SV từ database
    const [subRows] = await sequelize.query(
      `SELECT student_card_blob, student_card_mimetype FROM submissions WHERE id = ? AND user_id = ? LIMIT 1`,
      { replacements: [submissionId, userId] }
    );

    if (!Array.isArray(subRows) || subRows.length === 0) {
      return res.status(404).json({ message: "Submission not found" });
    }

    let cardBlob = subRows[0].student_card_blob;
    if (!cardBlob) {
      return res.status(400).json({ message: "Chưa upload ảnh thẻ sinh viên" });
    }

    // Đảm bảo cardBlob là Buffer
    if (!Buffer.isBuffer(cardBlob)) {
      if (typeof cardBlob === "string") {
        cardBlob = Buffer.from(cardBlob, "binary");
      } else if (typeof cardBlob === "object") {
        cardBlob = Buffer.from(cardBlob);
      } else {
        return res
          .status(400)
          .json({ message: "Ảnh thẻ sinh viên không hợp lệ" });
      }
    }

    // Gọi Python verify
    const { verifyStudentCard } = require("../services/verificationService");

    console.log(
      `[Verify Card] 🚀 Bắt đầu xác minh thẻ SV cho submission ${submissionId}`
    );
    console.log(`[Verify Card] 📊 Kích thước blob: ${cardBlob.length} bytes`);

    const result = await verifyStudentCard(cardBlob);

    console.log(
      `[Verify Card] 📝 Kết quả từ Python:`,
      JSON.stringify(result, null, 2)
    );

    if (!result.valid) {
      const reasons = result.details?.reasons?.join("\n") || "Không rõ lý do";
      const fieldsMatched = result.details?.fields_matched || [];
      const mssv = result.details?.mssv || "không tìm thấy";

      console.log(`[Verify Card] ❌ Thẻ SV không hợp lệ: ${reasons}`);
      return res.status(400).json({
        ok: false,
        valid: false,
        message: `❌ Thẻ sinh viên không hợp lệ!\n\nCác trường đã tìm thấy: ${fieldsMatched.join(", ") || "không có"
          }\nMSSV tìm thấy: ${mssv}\n\nLý do:\n${reasons}\n\n⚠️ Vui lòng upload lại ảnh thẻ SV rõ nét hơn!`,
        details: result.details,
      });
    }

    // ✅ Xác minh thành công - không cần update database (cột card_verified chưa có)
    console.log(
      `[Verify Card] ✅ Thẻ SV hợp lệ (MSSV: ${result.details?.mssv})`
    );
    return res.json({
      ok: true,
      valid: true,
      message: "✅ Thẻ SV hợp lệ!",
      details: result.details,
    });
  } catch (err) {
    console.error("[Verify Card] ❌ Lỗi chi tiết:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
      code: err.code,
    });

    // Provide actionable error messages
    let userMessage = "Lỗi xác minh thẻ SV";
    if (
      err.message.includes("numpy.dtype") ||
      err.message.includes("binary incompatibility")
    ) {
      userMessage =
        "🔧 Lỗi Python Environment: numpy/pandas không tương thích. Vui lòng chạy: python scripts/fix_python_env.py";
    } else if (err.message.includes("Missing Dependencies")) {
      userMessage = "🔧 " + err.message;
    } else if (err.message.includes("Failed to write to Python stdin")) {
      userMessage =
        "🔧 Lỗi Python Process: Python không khởi động được. Vui lòng kiểm tra môi trường Python.";
    }

    return res.status(500).json({
      message: userMessage,
      error: err.message,
      details: err.stack,
    });
  }
}

// POST /api/submissions/:id/verify-face (auth) - Xác minh khuôn mặt đã upload
async function verifyFaceImage(req, res) {
  try {
    const submissionId = req.params.id;
    const userId = req.user.id;

    // Lấy ảnh khuôn mặt từ database
    const [subRows] = await sequelize.query(
      `SELECT face_image_blob, face_image_mimetype FROM submissions WHERE id = ? AND user_id = ? LIMIT 1`,
      { replacements: [submissionId, userId] }
    );

    if (!Array.isArray(subRows) || subRows.length === 0) {
      return res.status(404).json({ message: "Submission not found" });
    }

    let faceBlob = subRows[0].face_image_blob;
    if (!faceBlob) {
      return res.status(400).json({ message: "Chưa upload ảnh khuôn mặt" });
    }

    // Đảm bảo faceBlob là Buffer
    if (!Buffer.isBuffer(faceBlob)) {
      if (typeof faceBlob === "string") {
        faceBlob = Buffer.from(faceBlob, "binary");
      } else if (typeof faceBlob === "object") {
        faceBlob = Buffer.from(faceBlob);
      } else {
        return res.status(400).json({ message: "Ảnh khuôn mặt không hợp lệ" });
      }
    }

    // Gọi Python verify
    const { verifyFaceLiveness } = require("../services/verificationService");

    console.log(
      `[Verify Face] Bắt đầu kiểm tra liveness cho submission ${submissionId}`
    );
    const livenessResult = await verifyFaceLiveness(faceBlob);

    if (!livenessResult.is_live) {
      const reasons = livenessResult.reasons?.join("\n") || "Không rõ lý do";
      const confidence = livenessResult.confidence || 0;
      console.log(`[Verify Face] ❌ Liveness check failed: ${reasons}`);
      return res.status(400).json({
        ok: false,
        valid: false,
        message: `❌ Ảnh khuôn mặt không hợp lệ!\n\nĐộ tin cậy: ${confidence}%\n\nLý do:\n${reasons}\n\n⚠️ Vui lòng chụp lại ảnh khuôn mặt!`,
        liveness: livenessResult,
      });
    }

    // ✅ Xác minh thành công - không cần update database (cột face_verified chưa có)
    console.log(
      `[Verify Face] ✅ Liveness check passed (${livenessResult.confidence}%)`
    );
    return res.json({
      ok: true,
      valid: true,
      message: `✅ Khuôn mặt hợp lệ! (Độ tin cậy: ${livenessResult.confidence}%)`,
      liveness: livenessResult,
    });
  } catch (err) {
    console.error("verifyFaceImage error:", err);
    return res
      .status(500)
      .json({ message: "Lỗi xác minh khuôn mặt", error: err.message });
  }
}

// POST /api/submissions/:id/compare-faces (auth) - So sánh khuôn mặt selfie vs thẻ SV
async function compareFaceImages(req, res) {
  try {
    const submissionId = req.params.id;
    const userId = req.user.id;

    // Lấy cả 2 ảnh từ database
    const [subRows] = await sequelize.query(
      `SELECT face_image_blob, student_card_blob
       FROM submissions WHERE id = ? AND user_id = ? LIMIT 1`,
      { replacements: [submissionId, userId] }
    );

    if (!Array.isArray(subRows) || subRows.length === 0) {
      return res.status(404).json({ message: "Submission not found" });
    }

    let { face_image_blob, student_card_blob } = subRows[0];

    if (!face_image_blob) {
      return res.status(400).json({ message: "Chưa upload ảnh khuôn mặt" });
    }
    if (!student_card_blob) {
      return res.status(400).json({ message: "Chưa upload ảnh thẻ sinh viên" });
    }

    // Đảm bảo cả 2 blobs là Buffers
    if (!Buffer.isBuffer(face_image_blob)) {
      if (typeof face_image_blob === "string") {
        face_image_blob = Buffer.from(face_image_blob, "binary");
      } else if (typeof face_image_blob === "object") {
        face_image_blob = Buffer.from(face_image_blob);
      } else {
        return res.status(400).json({ message: "Ảnh khuôn mặt không hợp lệ" });
      }
    }

    if (!Buffer.isBuffer(student_card_blob)) {
      if (typeof student_card_blob === "string") {
        student_card_blob = Buffer.from(student_card_blob, "binary");
      } else if (typeof student_card_blob === "object") {
        student_card_blob = Buffer.from(student_card_blob);
      } else {
        return res
          .status(400)
          .json({ message: "Ảnh thẻ sinh viên không hợp lệ" });
      }
    }

    // Gọi Python compare (tolerance 0.35 = 65% similarity)
    const { compareFaces } = require("../services/verificationService");
    const tolerance = req.body.tolerance || 0.35; // Frontend có thể gửi tolerance tùy chỉnh

    console.log(
      `[Compare Faces] Bắt đầu so sánh khuôn mặt cho submission ${submissionId} với tolerance ${tolerance}`
    );
    const matchResult = await compareFaces(
      face_image_blob,
      student_card_blob,
      tolerance
    );

    if (matchResult.error) {
      console.log(`[Compare Faces] ❌ Lỗi: ${matchResult.error}`);
      return res.status(400).json({
        ok: false,
        match: false,
        message: matchResult.error,
        details: matchResult,
      });
    }

    // Tính confidence từ distance (với Facenet512, distance < 0.30 là tốt)
    const confidence =
      matchResult.confidence || (1 - (matchResult.distance || 1)) * 100;
    const threshold = 50;
    const isMatch = confidence >= threshold;

    console.log(
      `[Compare Faces] Confidence: ${confidence.toFixed(
        1
      )}%, Threshold: ${threshold}%, Match: ${isMatch}`
    );

    if (!isMatch) {
      return res.status(400).json({
        ok: false,
        match: false,
        confidence: confidence,
        distance: matchResult.distance,
        threshold: threshold,
        message: `Khuôn mặt không khớp (độ tương đồng: ${confidence.toFixed(
          1
        )}%, yêu cầu ≥${threshold}%)`,
        details: matchResult,
      });
    }

    try {
      console.log(`[Compare Faces] 💾 Cập nhật ảnh đã xác minh vào DB...`);
      await sequelize.query(
        `UPDATE submissions 
         SET face_image_blob = ?, student_card_blob = ?
         WHERE id = ? AND user_id = ?`,
        {
          replacements: [
            face_image_blob,
            student_card_blob,
            submissionId,
            userId,
          ],
        }
      );
      console.log(`[Compare Faces] ✅ Đã cập nhật ảnh đã xác minh vào DB`);
    } catch (saveErr) {
      console.error(`[Compare Faces] ⚠️ Lỗi lưu DB:`, saveErr);
      return res.status(500).json({
        ok: false,
        match: false,
        message: "Lỗi lưu ảnh đã xác minh vào database",
        error: saveErr.message,
      });
    }

    console.log(
      `[Compare Faces] ✅ Khuôn mặt khớp (${confidence.toFixed(1)}%)`
    );
    return res.json({
      ok: true,
      match: true,
      confidence: confidence,
      distance: matchResult.distance,
      threshold: threshold,
      message: `Xác minh thành công! Độ tương đồng: ${confidence.toFixed(1)}%`,
      details: matchResult,
    });
  } catch (err) {
    console.error("compareFaceImages error:", err);
    return res
      .status(500)
      .json({ message: "Lỗi so sánh khuôn mặt", error: err.message });
  }
}

// POST /api/submissions/:id/upload-verified-images (auth) - Upload ảnh đã xác minh cuối cùng
async function uploadVerifiedImages(req, res) {
  try {
    const submissionId = req.params.id;
    const userId = req.user.id;

    // Kiểm tra submission tồn tại
    const [subRows] = await sequelize.query(
      `SELECT id FROM submissions WHERE id = ? AND user_id = ? LIMIT 1`,
      { replacements: [submissionId, userId] }
    );
    if (!Array.isArray(subRows) || subRows.length === 0) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const verifiedFace =
      req.files && req.files["verified_face"] && req.files["verified_face"][0];
    const verifiedCard =
      req.files && req.files["verified_card"] && req.files["verified_card"][0];

    if (!verifiedFace && !verifiedCard) {
      return res.status(400).json({ message: "Không có ảnh nào được tải lên" });
    }

    console.log(
      `[Upload Verified] submission ${submissionId}: face=${!!verifiedFace}, card=${!!verifiedCard}`
    );

    return res.json({
      ok: true,
      message: "Đã tải lên ảnh đã xác minh thành công",
      uploaded: {
        face: !!verifiedFace,
        card: !!verifiedCard,
      },
    });
  } catch (err) {
    console.error("uploadVerifiedImages error:", err);
    return res
      .status(500)
      .json({ message: "Lỗi tải ảnh đã xác minh", error: err.message });
  }
}

// POST /api/submissions/:id/verify (auth, multipart) - Legacy endpoint (giữ backward compatibility)
async function uploadVerifyAssets(req, res) {
  try {
    const submissionId = req.params.id;
    const userId = req.user.id;

    const [subRows] = await sequelize.query(
      `SELECT id FROM submissions WHERE id = ? AND user_id = ? LIMIT 1`,
      { replacements: [submissionId, userId] }
    );
    if (!Array.isArray(subRows) || subRows.length === 0) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Đánh dấu cờ xác minh nếu có các cột tương ứng
    const hasCol = async (table, col) => {
      const [rows] = await sequelize.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
        { replacements: [table, col] }
      );
      return Array.isArray(rows) && rows.length > 0;
    };

    const faceFile =
      req.files && req.files["face_image"] && req.files["face_image"][0];
    const cardFile =
      req.files &&
      req.files["student_card_image"] &&
      req.files["student_card_image"][0];
    const faceUploaded = !!faceFile;
    const cardUploaded = !!cardFile;

    // Import verification service
    const {
      verifyFaceLiveness,
      verifyStudentCard,
      compareFaces,
    } = require("../services/verificationService");

    let faceVerified = false;
    let cardVerified = false;
    let verificationErrors = [];
    let verificationDetails = {};

    // ========== BƯỚC 1: Xác minh khuôn mặt selfie (liveness) ==========
    if (faceUploaded) {
      try {
        console.log(
          `[Verify] Bước 1: Kiểm tra liveness cho submission ${submissionId}`
        );
        const livenessResult = await verifyFaceLiveness(faceFile.buffer);

        if (livenessResult.error) {
          verificationErrors.push(
            `Lỗi xác minh khuôn mặt: ${livenessResult.error}`
          );
          verificationDetails.face_liveness = { error: livenessResult.error };
        } else if (!livenessResult.is_live) {
          const reasons =
            livenessResult.reasons?.join(", ") || "Không rõ lý do";
          verificationErrors.push(`Ảnh khuôn mặt không hợp lệ: ${reasons}`);
          verificationDetails.face_liveness = {
            valid: false,
            confidence: livenessResult.confidence,
            reasons: livenessResult.reasons,
          };
        } else {
          faceVerified = true;
          verificationDetails.face_liveness = {
            valid: true,
            confidence: livenessResult.confidence,
          };
          console.log(
            `[Verify] ✅ Liveness check passed (${livenessResult.confidence}%)`
          );
        }
      } catch (livenessErr) {
        console.error("[Verify] Liveness check error:", livenessErr);
        verificationErrors.push(
          "Không thể xác minh khuôn mặt. Vui lòng thử lại."
        );
        verificationDetails.face_liveness = { error: livenessErr.message };
      }
    }

    // ========== BƯỚC 2: Xác minh thẻ sinh viên (OCR) ==========
    if (cardUploaded) {
      try {
        console.log(
          `[Verify] Bước 2: Kiểm tra thẻ SV cho submission ${submissionId}`
        );
        const cardResult = await verifyStudentCard(cardFile.buffer);

        if (cardResult.error) {
          verificationErrors.push(`Lỗi xác minh thẻ SV: ${cardResult.error}`);
          verificationDetails.student_card = { error: cardResult.error };
        } else if (!cardResult.valid) {
          const reasons = cardResult.reasons?.join(", ") || "Không rõ lý do";
          verificationErrors.push(`Thẻ sinh viên không hợp lệ: ${reasons}`);
          verificationDetails.student_card = {
            valid: false,
            fields_matched: cardResult.fields_matched,
            mssv: cardResult.mssv,
            reasons: cardResult.reasons,
          };
        } else {
          cardVerified = true;
          verificationDetails.student_card = {
            valid: true,
            fields_matched: cardResult.fields_matched,
            mssv: cardResult.mssv,
          };
          console.log(`[Verify] ✅ Card OCR passed (MSSV: ${cardResult.mssv})`);
        }
      } catch (cardErr) {
        console.error("[Verify] Card verification error:", cardErr);
        verificationErrors.push(
          "Không thể xác minh thẻ sinh viên. Vui lòng thử lại."
        );
        verificationDetails.student_card = { error: cardErr.message };
      }
    }

    // ========== BƯỚC 3: So sánh khuôn mặt (Face matching) ==========
    if (faceUploaded && cardUploaded && faceVerified && cardVerified) {
      try {
        console.log(
          `[Verify] Bước 3: So sánh khuôn mặt cho submission ${submissionId}`
        );
        const matchResult = await compareFaces(
          faceFile.buffer,
          cardFile.buffer,
          0.35
        );

        if (matchResult.error) {
          verificationErrors.push(
            `Lỗi so sánh khuôn mặt: ${matchResult.error}`
          );
          verificationDetails.face_match = { error: matchResult.error };
          faceVerified = false;
          cardVerified = false;
        } else {
          // Chuyển đổi confidence: distance càng thấp → confidence càng cao
          // Với Facenet512: distance < 0.30 là match tốt
          // Tính confidence ≈ (1 - distance) * 100
          const confidence =
            matchResult.confidence || (1 - (matchResult.distance || 1)) * 100;
          const threshold = 50; // Yêu cầu >= 50%

          if (confidence >= threshold) {
            verificationDetails.face_match = {
              valid: true,
              confidence: confidence,
              distance: matchResult.distance,
              match: true,
            };
            console.log(
              `[Verify] ✅ Face match passed (${confidence.toFixed(1)}%)`
            );
          } else {
            verificationErrors.push(
              `Khuôn mặt không khớp với thẻ sinh viên (độ tương đồng: ${confidence.toFixed(
                1
              )}%, yêu cầu ≥${threshold}%)`
            );
            verificationDetails.face_match = {
              valid: false,
              confidence: confidence,
              distance: matchResult.distance,
              match: false,
            };
            faceVerified = false;
            cardVerified = false;
          }
        }
      } catch (matchErr) {
        console.error("[Verify] Face matching error:", matchErr);
        verificationErrors.push(
          "Không thể so sánh khuôn mặt. Vui lòng thử lại."
        );
        verificationDetails.face_match = { error: matchErr.message };
        faceVerified = false;
        cardVerified = false;
      }
    }

    // Cập nhật database verification status
    try {
      if (faceVerified && (await hasCol("submissions", "face_verified"))) {
        await sequelize.query(
          `UPDATE submissions SET face_verified = 1 WHERE id = ?`,
          { replacements: [submissionId] }
        );
      }
      if (cardVerified && (await hasCol("submissions", "card_verified"))) {
        await sequelize.query(
          `UPDATE submissions SET card_verified = 1 WHERE id = ?`,
          { replacements: [submissionId] }
        );
      }
    } catch (e) {
      /* ignore if columns missing */
    }

    // Persist binary/photo if columns are available
    try {
      if (faceUploaded) {
        const hasBlob = await hasCol("submissions", "face_image_blob");
        const hasMime = await hasCol("submissions", "face_image_mimetype");
        const hasUrl = await hasCol("submissions", "face_image_url");
        if (hasBlob && hasMime) {
          await sequelize.query(
            `UPDATE submissions SET face_image_blob = ?, face_image_mimetype = ? WHERE id = ?`,
            {
              replacements: [
                faceFile.buffer,
                faceFile.mimetype || null,
                submissionId,
              ],
            }
          );
        } else if (hasUrl) {
          const uploadsDir = path.resolve(
            __dirname,
            "..",
            "uploads",
            "submissions",
            String(submissionId)
          );
          fs.mkdirSync(uploadsDir, { recursive: true });
          const outPath = path.join(uploadsDir, `face_${Date.now()}.jpg`);
          fs.writeFileSync(outPath, faceFile.buffer);
          const rel = outPath
            .split(path.resolve(__dirname, ".."))[1]
            .replace(/\\/g, "/");
          await sequelize.query(
            `UPDATE submissions SET face_image_url = ? WHERE id = ?`,
            {
              replacements: [
                rel.startsWith("/") ? rel : `/${rel}`,
                submissionId,
              ],
            }
          );
        }
      }
      if (cardUploaded) {
        const hasBlob = await hasCol("submissions", "student_card_blob");
        const hasMime = await hasCol("submissions", "student_card_mimetype");
        const hasUrl = await hasCol("submissions", "student_card_url");
        if (hasBlob && hasMime) {
          await sequelize.query(
            `UPDATE submissions SET student_card_blob = ?, student_card_mimetype = ? WHERE id = ?`,
            {
              replacements: [
                cardFile.buffer,
                cardFile.mimetype || null,
                submissionId,
              ],
            }
          );
        } else if (hasUrl) {
          const uploadsDir = path.resolve(
            __dirname,
            "..",
            "uploads",
            "submissions",
            String(submissionId)
          );
          fs.mkdirSync(uploadsDir, { recursive: true });
          const outPath = path.join(uploadsDir, `card_${Date.now()}.jpg`);
          fs.writeFileSync(outPath, cardFile.buffer);
          const rel = outPath
            .split(path.resolve(__dirname, ".."))[1]
            .replace(/\\/g, "/");
          await sequelize.query(
            `UPDATE submissions SET student_card_url = ? WHERE id = ?`,
            {
              replacements: [
                rel.startsWith("/") ? rel : `/${rel}`,
                submissionId,
              ],
            }
          );
        }
      }
    } catch (persistErr) {
      console.warn(
        "[uploadVerifyAssets] persist image error:",
        persistErr?.message || persistErr
      );
    }

    // Trả về response với thông tin chi tiết
    if (verificationErrors.length > 0) {
      return res.status(400).json({
        ok: false,
        face: false,
        card: false,
        errors: verificationErrors,
        details: verificationDetails,
        message: verificationErrors.join(" | "),
      });
    }

    return res.json({
      ok: true,
      face: faceVerified,
      card: cardVerified,
      details: verificationDetails,
      message: "Xác minh thành công",
    });
  } catch (err) {
    console.error("uploadVerifyAssets error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
}

// POST /api/submissions/:id/start
async function startExam(req, res) {
  try {
    const submissionId = req.params.id;
    const userId = req.user.id;

    // 1) Lấy submission với verification status
    const [subRows] = await sequelize.query(
      `SELECT 
        s.id, s.exam_id, s.user_id, s.status, s.submitted_at,
        (CASE WHEN s.face_image_url IS NOT NULL OR s.face_image_blob IS NOT NULL THEN 1 ELSE 0 END) AS face_verified,
        (CASE WHEN s.student_card_url IS NOT NULL OR s.student_card_blob IS NOT NULL THEN 1 ELSE 0 END) AS card_verified,
        e.require_face_check, e.require_student_card, e.monitor_screen
       FROM submissions s
       JOIN exams e ON e.id = s.exam_id
       WHERE s.id = ? AND s.user_id = ?
       LIMIT 1`,
      { replacements: [submissionId, userId] }
    );
    const sub =
      Array.isArray(subRows) && subRows.length > 0 ? subRows[0] : null;
    if (!sub) return res.status(404).json({ message: "Submission not found" });

    // 2) Kiểm tra verification requirements TRƯỚC KHI cho start
    if (sub.require_face_check && !sub.face_verified) {
      console.warn(
        `❌ Student ${userId} cố start exam ${sub.exam_id} nhưng chưa verify face`
      );
      return res.status(403).json({
        message: "Bạn cần xác minh khuôn mặt trước khi bắt đầu thi",
        requireFaceCheck: true,
        exam_id: sub.exam_id,
        submission_id: submissionId,
      });
    }

    if (sub.require_student_card && !sub.card_verified) {
      console.warn(
        `❌ Student ${userId} cố start exam ${sub.exam_id} nhưng chưa verify card`
      );
      return res.status(403).json({
        message: "Bạn cần xác minh thẻ sinh viên trước khi bắt đầu thi",
        requireCardCheck: true,
        exam_id: sub.exam_id,
        submission_id: submissionId,
      });
    }

    // 3) Kiểm tra status - CHỈ CHẶN nếu đã nộp bài (có submitted_at)
    console.log(`🔍 [startExam] Submission ${submissionId} status check:`, {
      status: sub.status,
      submitted_at: sub.submitted_at,
      user_id: userId,
    });

    // CHẶN nếu submission này đã được nộp (có submitted_at)
    if (sub.submitted_at) {
      console.warn(
        `❌ [startExam] Submission already submitted at ${sub.submitted_at}`
      );
      return res.status(400).json({
        message:
          "Bài thi này đã được nộp. Vui lòng tạo lần thi mới từ trang chủ.",
        submitted_at: sub.submitted_at,
        shouldCreateNewAttempt: true,
      });
    }

    // CHẶN nếu status là 'submitted' hoặc 'graded' (phải tạo submission mới)
    if (["submitted", "graded"].includes(sub.status)) {
      console.warn(`❌ [startExam] Cannot restart - status is ${sub.status}`);
      return res.status(400).json({
        message: `Bài thi này đã ${sub.status === "graded" ? "có kết quả" : "được nộp"
          }. Vui lòng tạo lần thi mới.`,
        status: sub.status,
        shouldCreateNewAttempt: true,
      });
    }

    // Kiểm tra các cột có tồn tại hay không để tránh lỗi trên các DB chưa migrate đủ
    let hasStartedAt = false,
      hasDurMin = false,
      hasOrderIndex = false;
    try {
      hasStartedAt = await hasColumn("submissions", "started_at");
    } catch (e) { }
    try {
      hasDurMin = await hasColumn("exams", "duration_minutes");
    } catch (e) { }
    try {
      hasOrderIndex = await hasColumn("exam_questions", "order_index");
    } catch (e) { }

    // nếu chưa có started_at, set ngay bây giờ (nếu cột tồn tại).
    const canInProgress = await (async () => {
      try {
        const [rows] = await sequelize.query(
          `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='submissions' AND COLUMN_NAME='status' LIMIT 1`
        );
        const ct =
          Array.isArray(rows) && rows[0]
            ? String(rows[0].COLUMN_TYPE || "")
            : "";
        return ct.includes("'in_progress'");
      } catch (e) {
        return false;
      }
    })();

    try {
      if (canInProgress) {
        await sequelize.query(
          `UPDATE submissions SET status = 'in_progress', started_at = COALESCE(started_at, NOW()) WHERE id = ?`,
          { replacements: [submissionId] }
        );
      } else if (hasStartedAt) {
        await sequelize.query(
          `UPDATE submissions SET started_at = COALESCE(started_at, NOW()) WHERE id = ?`,
          { replacements: [submissionId] }
        );
      }
    } catch (e) {
      /* ignore */
    }

    // Load questions + options
    let qSel = "SELECT q.id AS question_id, q.question_text, q.type, q.points";
    if (hasOrderIndex) qSel += ", q.order_index";
    qSel += " FROM exam_questions q WHERE q.exam_id = ?";
    qSel += hasOrderIndex
      ? " ORDER BY COALESCE(q.order_index, q.id) ASC"
      : " ORDER BY q.id ASC";
    const [qRows] = await sequelize.query(qSel, {
      replacements: [sub.exam_id || sub.examId || sub.EXAM_ID],
    });
    const questions = Array.isArray(qRows) ? qRows : [];

    // Load options for MCQ
    const ids = questions
      .filter((q) => q.type === "MCQ")
      .map((q) => q.question_id);
    let optionsByQ = {};
    if (ids.length > 0) {
      const [oRows] = await sequelize.query(
        `SELECT question_id, id AS option_id, option_text FROM exam_options WHERE question_id IN (${ids
          .map(() => "?")
          .join(",")}) ORDER BY id ASC`,
        { replacements: ids }
      );
      (Array.isArray(oRows) ? oRows : []).forEach((o) => {
        if (!optionsByQ[o.question_id]) optionsByQ[o.question_id] = [];
        optionsByQ[o.question_id].push({
          option_id: o.option_id,
          option_text: o.option_text,
        });
      });
    }

    const enriched = questions.map((q) =>
      q.type === "MCQ" ? { ...q, options: optionsByQ[q.question_id] || [] } : q
    );

    // get exam title + instructor + server now + started_at
    let exSel = "SELECT e.title AS exam_title, u.full_name AS instructor_name,";
    exSel += hasDurMin
      ? " e.duration_minutes AS duration_minutes"
      : " e.duration AS duration_minutes";
    exSel +=
      " FROM exams e LEFT JOIN users u ON u.id = e.instructor_id WHERE e.id = ? LIMIT 1";
    const [exRows] = await sequelize.query(exSel, {
      replacements: [sub.exam_id],
    });
    const ex = Array.isArray(exRows) ? exRows[0] : exRows || {};
    const [tRows] = await sequelize.query(`SELECT NOW() AS server_now`);
    const nowRow = Array.isArray(tRows) ? tRows[0] : tRows;

    // fetch started_at after update
    let started = nowRow.server_now;
    try {
      if (hasStartedAt) {
        const [s2] = await sequelize.query(
          `SELECT started_at FROM submissions WHERE id = ?`,
          { replacements: [submissionId] }
        );
        started =
          Array.isArray(s2) && s2[0] && s2[0].started_at
            ? s2[0].started_at
            : sub.started_at || nowRow.server_now;
      }
    } catch (e) {
      /* ignore */
    }

    return res.json({
      questions: enriched,
      duration_minutes: ex.duration_minutes || sub.duration || 60,
      started_at: started,
      server_now: nowRow.server_now,
      exam_title: ex.exam_title || "",
      instructor_name: ex.instructor_name || "",
    });
  } catch (err) {
    console.error("startExam error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// POST /api/submissions/:id/answer
async function saveAnswer(req, res) {
  try {
    const submissionId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    let { question_id, type, answer, selected_option_id, answer_text } =
      req.body || {};
    // Chuẩn hóa payload theo loại câu hỏi
    if (type === "MCQ" && selected_option_id != null) {
      answer = selected_option_id;
    }
    if (type !== "MCQ" && answer_text != null) {
      answer = answer_text;
    }
    if (!question_id)
      return res.status(400).json({ message: "question_id required" });

    // verify submission belongs to user
    const [subRows] = await sequelize.query(
      `SELECT id FROM submissions WHERE id = ? AND user_id = ? LIMIT 1`,
      { replacements: [submissionId, userId] }
    );
    if (!Array.isArray(subRows) || subRows.length === 0) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Guard by time: nếu có started_at & duration, không cho lưu sau deadline (+grace 15s)
    try {
      const [timing] = await sequelize.query(
        `SELECT s.started_at, COALESCE(e.duration_minutes, e.duration) AS duration_minutes
         FROM submissions s JOIN exams e ON e.id = s.exam_id WHERE s.id = ? LIMIT 1`,
        { replacements: [submissionId] }
      );
      const tm = Array.isArray(timing) ? timing[0] : timing;
      if (tm && tm.started_at && tm.duration_minutes) {
        const [chk] = await sequelize.query(
          `SELECT CASE WHEN NOW() > (TIMESTAMPADD(MINUTE, ?, ?)) THEN 1 ELSE 0 END AS overdue`,
          { replacements: [Number(tm.duration_minutes) + 0.25, tm.started_at] } // grace 15s ~ 0.25 min
        );
        const over = Array.isArray(chk) ? chk[0]?.overdue : chk?.overdue;
        if (Number(over) === 1)
          return res.status(403).json({ message: "Hết thời gian làm bài" });
      }
    } catch (e) {
      /* ignore if columns missing */
    }

    // find existing answer
    const [aRows] = await sequelize.query(
      `SELECT id FROM student_answers WHERE submission_id = ? AND question_id = ? LIMIT 1`,
      { replacements: [submissionId, question_id] }
    );
    if (Array.isArray(aRows) && aRows.length > 0) {
      const ansId = aRows[0].id;
      if (type === "MCQ") {
        await sequelize.query(
          `UPDATE student_answers SET selected_option_id = ?, answer_text = NULL WHERE id = ?`,
          { replacements: [answer, ansId] }
        );
      } else {
        await sequelize.query(
          `UPDATE student_answers SET answer_text = ?, selected_option_id = NULL WHERE id = ?`,
          { replacements: [answer, ansId] }
        );
      }
    } else {
      if (type === "MCQ") {
        await sequelize.query(
          `INSERT INTO student_answers(submission_id, question_id, student_id, selected_option_id) VALUES (?, ?, ?, ?)`,
          { replacements: [submissionId, question_id, userId, answer] }
        );
      } else {
        await sequelize.query(
          `INSERT INTO student_answers(submission_id, question_id, student_id, answer_text) VALUES (?, ?, ?, ?)`,
          { replacements: [submissionId, question_id, userId, answer || null] }
        );
      }
    }

    // Optional: cập nhật tổng MCQ nhanh
    if (type === "MCQ") {
      try {
        await sequelize.query(
          `UPDATE student_answers sa
              JOIN exam_options o  ON o.id = sa.selected_option_id
              JOIN exam_questions q ON q.id = sa.question_id
           SET sa.score = CASE WHEN o.is_correct THEN COALESCE(q.points,1) ELSE 0 END,
               sa.status = 'graded', sa.graded_at = NOW()
           WHERE sa.submission_id = ? AND sa.question_id = ?`,
          { replacements: [submissionId, question_id] }
        );
        await sequelize.query(
          `UPDATE submissions SET total_score = (
              SELECT COALESCE(SUM(score),0) FROM student_answers WHERE submission_id = ?
           ) WHERE id = ?`,
          { replacements: [submissionId, submissionId] }
        );
      } catch (e) {
        /* ignore */
      }
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("saveAnswer error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// POST /api/submissions/:id/proctor-event
async function proctorEvent(req, res) {
  try {
    const submissionId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { event_type } = req.body || {};

    try {
      const [rows] = await sequelize.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'monitor_agreed'`
      );
      const hasMonitor = Array.isArray(rows) && rows.length > 0;
      if (hasMonitor && event_type === "monitor_start") {
        await sequelize.query(
          `UPDATE submissions SET monitor_agreed = 1 WHERE id = ? AND user_id = ?`,
          { replacements: [submissionId, userId] }
        );
      }
    } catch (e) {
      /* ignore */
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("proctorEvent error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// POST /api/submissions/:id/submit
async function submitExam(req, res) {
  try {
    const submissionId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    // fetch submission & exam
    const [subRows] = await sequelize.query(
      `SELECT s.id, s.exam_id FROM submissions s WHERE s.id = ? AND s.user_id = ? LIMIT 1`,
      { replacements: [submissionId, userId] }
    );
    const sub = Array.isArray(subRows) ? subRows[0] : subRows;
    if (!sub) return res.status(404).json({ message: "Submission not found" });

    // grade MCQ locally
    const [mcqRows] = await sequelize.query(
      `SELECT q.id AS question_id, q.points,
              o.id AS option_id, o.is_correct,
              a.selected_option_id
       FROM exam_questions q
       LEFT JOIN exam_options o ON o.question_id = q.id AND o.is_correct = TRUE
       LEFT JOIN student_answers a ON a.question_id = q.id AND a.submission_id = ?
       WHERE q.exam_id = ? AND q.type = 'MCQ'`,
      { replacements: [submissionId, sub.exam_id] }
    );

    let totalScore = 0;
    (Array.isArray(mcqRows) ? mcqRows : []).forEach((r) => {
      if (
        r.selected_option_id &&
        r.option_id &&
        r.selected_option_id === r.option_id
      ) {
        totalScore += Number(r.points || 0);
      }
    });

    await sequelize.query(
      `UPDATE submissions SET total_score = ?, suggested_total_score = total_score + COALESCE(ai_score,0), status='graded', submitted_at = NOW() WHERE id = ?`,
      { replacements: [totalScore, submissionId] }
    );

    // ✅ Trigger AI Grading for Essays (Fire & Forget)
    try {
      gradeSubmission(submissionId);
    } catch (e) {
      console.warn("⚠️ [submitExam] Failed to queue AI grading:", e.message);
    }

    // Try stored procedure if exists
    try {
      await sequelize.query(`CALL sp_submit_exam(?, ?)`, {
        replacements: [sub.exam_id, userId],
      });
    } catch (e) {
      /* ignore if SP missing */
    }

    // LOGIC TỰ ĐỘNG SO SÁNH ĐIỂM CAO NHẤT
    try {
      const [allScores] = await sequelize.query(
        `SELECT id, total_score, attempt_no 
         FROM submissions 
         WHERE exam_id = ? AND user_id = ? AND status = 'graded' AND total_score IS NOT NULL
         ORDER BY total_score DESC, submitted_at DESC`,
        { replacements: [sub.exam_id, userId] }
      );

      if (allScores && allScores.length > 0) {
        const bestSubmission = allScores[0];
        const currentScore = totalScore;

        console.log(`📊 [submitExam] Score comparison:`, {
          user_id: userId,
          exam_id: sub.exam_id,
          current_score: currentScore,
          best_score: bestSubmission.total_score,
          best_submission_id: bestSubmission.id,
          total_attempts: allScores.length,
        });

        if (bestSubmission.id === submissionId) {
          console.log(
            `🏆 [submitExam] NEW BEST SCORE! User ${userId} achieved ${currentScore} points (attempt ${bestSubmission.attempt_no})`
          );
        } else {
          console.log(
            `ℹ️ [submitExam] Not best score. Current: ${currentScore}, Best: ${bestSubmission.total_score} (submission ${bestSubmission.id})`
          );
        }
      }
    } catch (e) {
      console.warn("⚠️ [submitExam] Could not analyze best score:", e.message);
    }

    const [finalRows] = await sequelize.query(
      `SELECT total_score, ai_score, suggested_total_score, status FROM submissions WHERE id = ?`,
      { replacements: [submissionId] }
    );
    const resp = Array.isArray(finalRows) ? finalRows[0] : finalRows;
    return res.json({
      status: resp?.status || "graded",
      total_score: resp?.total_score || 0,
      ai_score: resp?.ai_score || null,
      suggested_total_score: resp?.suggested_total_score || totalScore,
    });
  } catch (err) {
    console.error("submitExam error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /api/results/my
async function myResults(req, res) {
  try {
    const userId = req.user.id;

    // Try view first
    try {
      const [rows] = await sequelize.query(
        `SELECT * FROM v_student_results WHERE student_id = ? ORDER BY submitted_at DESC`,
        { replacements: [userId] }
      );
      return res.json(rows);
    } catch (e) {
      // fallback
      const [rows] = await sequelize.query(
        `SELECT s.id AS submission_id, s.exam_id, e.title AS exam_title,
                s.total_score AS mcq_score, s.ai_score AS essay_score,
                s.suggested_total_score, s.submitted_at
         FROM submissions s JOIN exams e ON e.id = s.exam_id
         WHERE s.user_id = ? ORDER BY s.submitted_at DESC`,
        { replacements: [userId] }
      );
      return res.json(rows);
    }
  } catch (err) {
    console.error("myResults error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /api/exams/:id/public-info
async function getExamPublicInfo(req, res) {
  try {
    const examId = parseInt(req.params.id, 10);
    const [rows] = await sequelize.query(
      `SELECT e.id, e.title, e.duration, e.duration_minutes, e.time_open, e.time_close, e.max_points,
              e.require_face_check, e.require_student_card, e.monitor_screen,
              u.full_name AS instructor_name
       FROM exams e
       LEFT JOIN users u ON u.id = e.instructor_id
       WHERE e.id = ? AND e.status = 'published'
       LIMIT 1`,
      { replacements: [examId] }
    );
    const info = Array.isArray(rows) ? rows[0] : rows;
    if (!info)
      return res
        .status(404)
        .json({ message: "Exam not found or not published" });
    return res.json(info);
  } catch (err) {
    console.error("getExamPublicInfo error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /api/submissions/:id/status - Lấy trạng thái verification của submission
async function getSubmissionStatus(req, res) {
  try {
    const submissionId = req.params.id;
    const userId = req.user.id;

    // Kiểm tra submission tồn tại và thuộc về user
    const [rows] = await sequelize.query(
      `SELECT 
        id, exam_id, user_id, status,
        face_image_url, student_card_url,
        CASE WHEN face_image_blob IS NOT NULL OR face_image_url IS NOT NULL THEN TRUE ELSE FALSE END as face_verified,
        CASE WHEN student_card_blob IS NOT NULL OR student_card_url IS NOT NULL THEN TRUE ELSE FALSE END as card_verified
       FROM submissions 
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      { replacements: [submissionId, userId] }
    );

    const submission = Array.isArray(rows) ? rows[0] : rows;
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    return res.json({
      submission_id: submission.id,
      exam_id: submission.exam_id,
      status: submission.status,
      face_image_url: submission.face_image_url,
      student_card_url: submission.student_card_url,
      face_verified: !!submission.face_verified,
      card_verified: !!submission.card_verified,
    });
  } catch (err) {
    console.error("getSubmissionStatus error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  verifyRoom,
  joinExam,
  startExam,
  saveAnswer,
  submitExam,
  proctorEvent,
  uploadVerifyAssets,
  uploadImages,
  verifyStudentCardImage,
  verifyFaceImage,
  compareFaceImages,
  uploadVerifiedImages,
  myResults,
  getExamPublicInfo,
  getSubmissionStatus,
};
