const sequelize = require("../../config/db");
const { gradeSubmission } = require("../../services/AIService");

// Import hasColumn helper from RoomController
const { hasColumn } = require("./RoomController");

// Controller Methods
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

        // Kiểm tra các cột có tồn tại hay không
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

        // Kiểm tra status enum có 'in_progress' không
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
        let exSel = "SELECT e.title AS exam_title, u.full_name AS instructor_name, e.intent_shuffle,";
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
            intent_shuffle: !!ex.intent_shuffle,
        });
    } catch (err) {
        console.error("startExam error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

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

        // Guard by time
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
                    { replacements: [Number(tm.duration_minutes) + 0.25, tm.started_at] }
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

module.exports = {
    startExam,
    saveAnswer,
    proctorEvent,
    submitExam,
};
