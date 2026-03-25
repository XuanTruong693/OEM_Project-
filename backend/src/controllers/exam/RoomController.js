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
                // CHO PHÉP NẾU CÓ BÀI THI ĐANG DỞ HOẶC PENDING (Chưa bắt đầu thi)
                const [activeSub] = await sequelize.query(
                    `SELECT id FROM submissions WHERE exam_id = ? AND user_id = ? AND status IN ('pending', 'in_progress') LIMIT 1`,
                    { replacements: [exam.id, userId] }
                );

                if (!Array.isArray(activeSub) || activeSub.length === 0) {
                    // đếm số bài thi ĐÃ NỘP/CHẤM
                    const [consumedRows] = await sequelize.query(
                        `SELECT COUNT(*) as attempt_count FROM submissions WHERE exam_id = ? AND user_id = ? AND status NOT IN ('pending', 'in_progress')`,
                        { replacements: [exam.id, userId] }
                    );
                    const currentAttempts = consumedRows[0]?.attempt_count || 0;

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

        // time window check
        if (extra.time_open || extra.time_close) {
            const nowTime = new Date().getTime();
            const openTime = extra.time_open ? new Date(extra.time_open).getTime() : null;
            const closeTime = extra.time_close ? new Date(extra.time_close).getTime() : null;

            if (openTime && nowTime < openTime) {
                return res.status(403).json({
                    message: "Chưa đến giờ mở phòng",
                    now: nowTime,
                    time_open: extra.time_open,
                    reason: "before_open",
                });
            }

            if (closeTime && nowTime > closeTime) {
                return res.status(403).json({
                    message: "Đã hết giờ làm bài",
                    now: nowTime,
                    time_close: extra.time_close,
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
        let exQ = `SELECT id, exam_room_code, status, duration, max_attempts`;
        let hasTC = false;
        try { hasTC = await hasColumn("exams", "time_close"); } catch (e) {}
        if (hasTC) exQ += `, time_close`;
        exQ += ` FROM exams WHERE id = ? AND exam_room_code = ? AND status = 'published'`;

        const [rows] = await sequelize.query(exQ, { replacements: [exam_id, room_code] });
        const exam = Array.isArray(rows) ? rows[0] : rows;
        if (!exam) return res.status(404).json({ message: "Exam not available" });

        if (exam.time_close && new Date().getTime() > new Date(exam.time_close).getTime()) {
            return res.status(403).json({ message: "Đã hết giờ làm bài" });
        }

        // Kiểm tra lại số lần thi (phòng bypass)
        const maxAttempts = exam.max_attempts || 0;
        let submissionId;
        let nextAttempt;

        const [existing] = await sequelize.query(
            `SELECT id, attempt_no FROM submissions 
             WHERE exam_id = ? AND user_id = ? AND status IN ('pending', 'in_progress') ORDER BY id DESC LIMIT 1`,
            { replacements: [exam_id, userId] }
        );

        if (Array.isArray(existing) && existing.length > 0) {
            submissionId = existing[0].id;
            nextAttempt = existing[0].attempt_no;
            console.log(`✅ [joinExam] Reusing active submission ${submissionId} for user ${userId}, exam ${exam_id}, attempt ${nextAttempt}`);
        } else {
            if (maxAttempts > 0) {
                const [attemptCount] = await sequelize.query(
                    `SELECT COUNT(*) as attempt_count FROM submissions WHERE exam_id = ? AND user_id = ? AND status NOT IN ('pending', 'in_progress')`,
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

            const [maxAttempt] = await sequelize.query(
                `SELECT COALESCE(MAX(attempt_no), 0) AS max_attempt FROM submissions WHERE exam_id = ? AND user_id = ?`,
                { replacements: [exam_id, userId] }
            );

            nextAttempt = (maxAttempt[0]?.max_attempt || 0) + 1;

            const [ins] = await sequelize.query(
                `INSERT INTO submissions (exam_id, user_id, status, attempt_no, submitted_at, cheating_count) 
                 VALUES (?, ?, 'pending', ?, NULL, 0)`,
                { replacements: [exam_id, userId, nextAttempt] }
            );
            submissionId = ins?.insertId || ins;

            console.log(
                `✅ [joinExam] Created new submission ${submissionId} for user ${userId}, exam ${exam_id}, attempt ${nextAttempt}`
            );
        }

        // Record verified room (if table exists)
        try {
            await sequelize.query(
                `INSERT IGNORE INTO user_verified_rooms(user_id, exam_room_code, verified_at)
         VALUES (?, ?, NOW())`,
                { replacements: [userId, room_code] }
            );
        } catch (e) { }

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
