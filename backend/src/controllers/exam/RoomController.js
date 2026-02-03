const jwt = require("jsonwebtoken");
const sequelize = require("../../config/db");
const ExamRepository = require("../../repositories/ExamRepository");
const SubmissionRepository = require("../../repositories/SubmissionRepository");

// Helper Functions

/**
 * Sign a short-lived room token
 * @param {Object} payload - Token payload
 * @param {number} ttlSeconds - Time to live in seconds (default 15 minutes)
 */
function signRoomToken(payload, ttlSeconds = 15 * 60) {
    const secret = process.env.JWT_SECRET || "dev_secret";
    return jwt.sign(payload, secret, { expiresIn: ttlSeconds });
}

/**
 * Verify room token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Token claims or null if invalid
 */
function verifyRoomToken(token) {
    const secret = process.env.JWT_SECRET || "dev_secret";
    try {
        return jwt.verify(token, secret);
    } catch (e) {
        return null;
    }
}

/**
 * Check if a column exists in a table
 * @param {string} table - Table name
 * @param {string} column - Column name
 */
async function hasColumn(table, column) {
    const [rows] = await sequelize.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
        { replacements: [table, column] }
    );
    return Array.isArray(rows) && rows.length > 0;
}

// Controller Methods
async function verifyRoom(req, res) {
    try {
        const { room_code } = req.body || {};
        console.log('🔍 [verifyRoom] Received room_code:', room_code, 'Length:', room_code?.length);

        if (!room_code)
            return res.status(400).json({ message: "room_code is required" });

        // Trim room code để tránh lỗi do khoảng trắng
        const trimmedCode = String(room_code).trim();
        console.log('🔍 [verifyRoom] Trimmed room_code:', trimmedCode, 'Length:', trimmedCode.length);

        // Check exam exists and is published (using Repository)
        const exam = await ExamRepository.findByRoomCode(trimmedCode, true);
        console.log('📊 [verifyRoom] Query result:', exam);

        if (!exam) {
            console.log('❌ [verifyRoom] Exam not found or not published for code:', trimmedCode);
            // Kiểm tra xem exam có tồn tại không (bất kể status)
            const examAnyStatus = await ExamRepository.findByRoomCode(trimmedCode, false);
            console.log('🔎 [verifyRoom] Check all statuses:', examAnyStatus);

            return res
                .status(404)
                .json({ message: "Mã không đúng hoặc phòng chưa mở" });
        }

        console.log('✅ [verifyRoom] Found exam:', exam.id, 'Status:', exam.status);

        // Kiểm tra số lần thi (nếu user đã đăng nhập)
        if (req.user && req.user.id) {
            const userId = req.user.id;

            // Lấy max_attempts từ exam (using Repository)
            const maxAttempts = exam.max_attempts || 0;

            // Nếu max_attempts > 0, kiểm tra số lần đã thi
            if (maxAttempts > 0) {
                // Using SubmissionRepository
                const currentAttempts = await SubmissionRepository.countAttempts(exam.id, userId);

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
            time_open                                AS open_ts,
            time_close                               AS close_ts,
            (CASE WHEN time_open IS NOT NULL AND CONVERT_TZ(NOW(), @@session.time_zone, ?) < time_open THEN 1 ELSE 0 END) AS before_open,
            (CASE WHEN time_close IS NOT NULL AND CONVERT_TZ(NOW(), @@session.time_zone, ?) > time_close THEN 1 ELSE 0 END) AS after_close
         FROM exams
         WHERE id = ? LIMIT 1
         `,
                {
                    replacements: [
                        tz,
                        tz,
                        tz,
                        exam.id,
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

// Export for use in routes and other controllers
module.exports = {
    // Controller methods
    verifyRoom,
    joinExam,
    // Helper functions (exported for use by other controllers)
    signRoomToken,
    verifyRoomToken,
    hasColumn,
};
