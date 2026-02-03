const sequelize = require("../../config/db");
const crypto = require("crypto");

/**
 * Check if instructor owns the exam
 */
async function ensureExamOwnership(examId, instructorId) {
    const [rows] = await sequelize.query(
        `SELECT id FROM exams WHERE id = ? AND instructor_id = ? LIMIT 1`,
        { replacements: [examId, instructorId] }
    );
    return rows && rows.length > 0;
}

/**
 * Get exam row by ID
 */
async function getExamRow(examId) {
    const [rows] = await sequelize.query(
        `SELECT * FROM exams WHERE id = ? LIMIT 1`,
        { replacements: [examId] }
    );
    return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * Generate unique room code
 */
function generateRoomCode() {
    return crypto.randomBytes(3).toString("hex").toUpperCase();
}

/**
 * GET /api/instructor/exams/my
 * Get instructor's exams
 */
async function getMyExams(req, res) {
    try {
        const instructorId = req.user.id;
        const [rows] = await sequelize.query(
            `
      SELECT 
        e.*,
        COUNT(DISTINCT s.id) AS submission_count,
        COUNT(DISTINCT s.user_id) AS student_count
      FROM exams e
      LEFT JOIN submissions s ON s.exam_id = e.id
      WHERE e.instructor_id = ?
      GROUP BY e.id
      ORDER BY e.created_at DESC
      `,
            { replacements: [instructorId] }
        );

        res.json(rows);
    } catch (err) {
        console.error("❌ Error fetching my exams:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * GET /api/instructor/exams/:examId/preview
 * Preview exam questions
 */
async function getExamPreview(req, res) {
    try {
        const examId = parseInt(req.params.examId, 10);
        if (!Number.isFinite(examId)) {
            return res.status(400).json({ message: "examId invalid" });
        }

        // Check ownership or published
        const isOwner = await ensureExamOwnership(examId, req.user.id);
        if (!isOwner) {
            const exam = await getExamRow(examId);
            if (!exam || exam.status !== "published") {
                return res.status(403).json({ message: "Access denied" });
            }
        }

        const [rows] = await sequelize.query(
            `
      SELECT 
        q.id AS question_id,
        q.question_text,
        q.type,
        q.points,
        q.model_answer,
        o.id AS option_id,
        o.option_text,
        o.is_correct
      FROM exam_questions q
      LEFT JOIN exam_options o ON o.question_id = q.id
      WHERE q.exam_id = ?
      ORDER BY q.id, o.id
      `,
            { replacements: [examId] }
        );

        const [[examInfo]] = await sequelize.query(
            `SELECT time_open, time_close, status, title FROM exams WHERE id = ? LIMIT 1`,
            { replacements: [examId] }
        );
        const exam = examInfo || {};

        // Group options by question
        const map = new Map();
        for (const r of rows || []) {
            if (!map.has(r.question_id)) {
                map.set(r.question_id, {
                    question_id: r.question_id,
                    question_text: r.question_text,
                    type: r.type,
                    points: r.points,
                    model_answer: r.model_answer,
                    options: [],
                });
            }
            if (r.option_id) {
                map.get(r.question_id).options.push({
                    option_id: r.option_id,
                    option_text: r.option_text,
                    is_correct: r.is_correct,
                });
            }
        }

        return res.json({
            exam_id: examId,
            title: exam.title,
            questions: Array.from(map.values()),
            time_open: exam.time_open || null,
            time_close: exam.time_close || null,
            status: exam.status || "draft",
        });
    } catch (err) {
        console.error("exams/:examId/preview error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

/**
 * GET /api/instructor/exams/:examId/summary
 * Get exam summary statistics
 */
async function getExamSummary(req, res) {
    try {
        const examId = parseInt(req.params.examId, 10);
        if (!Number.isFinite(examId)) {
            return res.status(400).json({ message: "examId invalid" });
        }

        const isOwner = await ensureExamOwnership(examId, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ message: "Access denied" });
        }

        const [[q1]] = await sequelize.query(
            `SELECT COUNT(*) AS total_questions FROM exam_questions WHERE exam_id = ?`,
            { replacements: [examId] }
        );

        const [[q2]] = await sequelize.query(
            `SELECT COUNT(DISTINCT user_id) AS total_students FROM submissions WHERE exam_id = ?`,
            { replacements: [examId] }
        );

        const [[q3]] = await sequelize.query(
            `SELECT COUNT(*) AS total_submissions, AVG(total_score + COALESCE(ai_score, 0)) AS avg_score FROM submissions WHERE exam_id = ?`,
            { replacements: [examId] }
        );

        const [[q4]] = await sequelize.query(
            `SELECT MAX(submitted_at) AS last_submission_time FROM submissions WHERE exam_id = ?`,
            { replacements: [examId] }
        );

        return res.json({
            exam_id: examId,
            total_questions: q1?.total_questions || 0,
            total_students: q2?.total_students || 0,
            total_submissions: q3?.total_submissions || 0,
            avg_score: q3?.avg_score || 0,
            last_submission_time: q4?.last_submission_time || null,
        });
    } catch (err) {
        console.error("exams/:examId/summary error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

/**
 * POST /api/instructor/exams/:examId/publish
 * Publish exam
 */
async function publishExam(req, res) {
    try {
        const examId = parseInt(req.params.examId, 10);
        if (!Number.isFinite(examId)) {
            return res.status(400).json({ message: "examId invalid" });
        }

        const isOwner = await ensureExamOwnership(examId, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Generate room code if not exists
        let roomCode = generateRoomCode();

        await sequelize.query(
            `UPDATE exams SET status = 'published', exam_room_code = COALESCE(exam_room_code, ?) WHERE id = ?`,
            { replacements: [roomCode, examId] }
        );

        const [[exam]] = await sequelize.query(
            `SELECT exam_room_code FROM exams WHERE id = ?`,
            { replacements: [examId] }
        );

        return res.json({
            message: "Exam published successfully",
            exam_id: examId,
            room_code: exam?.exam_room_code || roomCode,
        });
    } catch (err) {
        console.error("publishExam error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

/**
 * POST /api/instructor/exams/:examId/unpublish
 * Unpublish exam
 */
async function unpublishExam(req, res) {
    try {
        const examId = parseInt(req.params.examId, 10);
        if (!Number.isFinite(examId)) {
            return res.status(400).json({ message: "examId invalid" });
        }

        const isOwner = await ensureExamOwnership(examId, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ message: "Access denied" });
        }

        await sequelize.query(
            `UPDATE exams SET status = 'draft' WHERE id = ?`,
            { replacements: [examId] }
        );

        return res.json({
            message: "Exam unpublished successfully",
            exam_id: examId,
        });
    } catch (err) {
        console.error("unpublishExam error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}



// ==============================
// 🗑️ Purge Exam Data (Delete all submissions)
// ==============================
const purgeExam = async (req, res) => {
    try {
        const examId = parseInt(req.params.examId, 10);
        const instructorId = req.user.id;
        if (!Number.isFinite(examId))
            return res.status(400).json({ message: "examId invalid" });

        // ownership check
        const ok = await ensureExamOwnership(examId, instructorId);
        if (!ok) return res.status(403).json({ message: "Access denied" });

        // Delete submissions (should cascade to student_answers / cheating logs if FK cascade configured)
        const [result] = await sequelize.query(
            `DELETE FROM submissions WHERE exam_id = ?`,
            { replacements: [examId] }
        );
        const deleted = result.affectedRows || 0;

        console.log(
            `🧹 [PurgeExam] Instructor ${instructorId} purged ${deleted} submissions for exam ${examId}`
        );
        return res.json({ ok: true, deleted_count: deleted });
    } catch (err) {
        console.error("❌ Error purging exam data:", err);
        return res
            .status(500)
            .json({ message: "Server error while purging exam data" });
    }
};

// ==============================
// 📋 Clone Exam
// ==============================
const cloneExam = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const examId = parseInt(req.params.examId, 10);
        const instructorId = req.user.id;
        if (!Number.isFinite(examId)) {
            await transaction.rollback();
            return res.status(400).json({ message: "examId invalid" });
        }

        // ownership
        const [own] = await sequelize.query(
            `SELECT * FROM exams WHERE id = ? AND instructor_id = ? LIMIT 1`,
            { replacements: [examId, instructorId], transaction }
        );
        if (!Array.isArray(own) || own.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ message: "Exam not found" });
        }

        // copy exam metadata (keep as draft)
        const src = own[0];
        const [ins] = await sequelize.query(
            `INSERT INTO exams (instructor_id, title, duration, duration_minutes, max_points, require_face_check, 
  require_student_card, monitor_screen, max_attempts, status, created_at, updated_at)
             VALUES (?, CONCAT(?, ' (copy)'), ?, ?, ?, ?, ?, ?, ?, 'draft', NOW(), NOW())`,
            {
                replacements: [
                    instructorId,
                    src.title || "",
                    src.duration || null,
                    src.duration_minutes || null,
                    src.max_points || null,
                    src.require_face_check ? 1 : 0,
                    src.require_student_card ? 1 : 0,
                    src.monitor_screen ? 1 : 0,
                    src.max_attempts || 0,
                ],
                transaction,
            }
        );
        const newExamId = ins?.insertId || ins;

        // copy questions
        const [qRows] = await sequelize.query(
            `SELECT id, question_text, type, points, order_index, model_answer FROM exam_questions WHERE exam_id = ? 
  ORDER BY order_index, id`,
            { replacements: [examId], transaction }
        );
        for (const q of qRows || []) {
            const [qIns] = await sequelize.query(
                `INSERT INTO exam_questions (exam_id, question_text, type, points, order_index, model_answer)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                {
                    replacements: [
                        newExamId,
                        q.question_text,
                        q.type,
                        q.points,
                        q.order_index,
                        q.model_answer,
                    ],
                    transaction,
                }
            );
            const newQId = qIns?.insertId || qIns;

            // copy options if MCQ
            if (q.type === "MCQ") {
                const [opts] = await sequelize.query(
                    `SELECT option_text, is_correct FROM exam_options WHERE question_id = ?`,
                    { replacements: [q.id], transaction }
                );
                for (const o of opts || []) {
                    await sequelize.query(
                        `INSERT INTO exam_options (question_id, option_text, is_correct)
                         VALUES (?, ?, ?)`,
                        {
                            replacements: [newQId, o.option_text, o.is_correct ? 1 : 0],
                            transaction,
                        }
                    );
                }
            }
        }

        await transaction.commit();
        console.log(
            `✅ [CloneExam] Instructor ${instructorId} cloned exam ${examId} -> ${newExamId}`
        );
        return res.json({ ok: true, exam_id: newExamId });
    } catch (err) {
        await transaction.rollback();
        console.error("❌ Error cloning exam:", err);
        return res
            .status(500)
            .json({ message: "Server error while cloning exam" });
    }
};



// ==============================
// 🚪 Open Exam (Publish and generate room code)
// ==============================
const openExam = async (req, res) => {
    try {
        const examId = parseInt(req.params.examId, 10);
        const {
            duration,
            duration_minutes,
            openAt,
            closeAt,
            max_points,
            require_face_check,
            require_student_card,
            monitor_screen,
            max_attempts,
        } = req.body;
        const instructorId = req.user.id;
        if (!Number.isFinite(examId))
            return res.status(400).json({ message: "examId invalid" });

        // ownership check
        const ok = await ensureExamOwnership(examId, instructorId);
        if (!ok) return res.status(403).json({ message: "Access denied" });

        // generate room code
        const genCode = () => {
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let code = "";
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        };

        let room = genCode();
        // retry if duplicate room code
        try {
            for (let i = 0; i < 5; i++) {
                const [r] = await sequelize.query(
                    `SELECT 1 FROM exams WHERE exam_room_code = ? LIMIT 1`,
                    { replacements: [room] }
                );
                if (!Array.isArray(r) || r.length === 0) break;
                room = genCode();
            }
        } catch { }

        // build update set
        const dur = Number(duration || duration_minutes || 0) || null;
        const durMin = Number(duration_minutes || duration || 0) || null;

        const fmt = (d) => {
            // accept ISO/local datetime; format to 'YYYY-MM-DD HH:MM:SS'
            if (!d) return null;
            const pad = (n) => String(n).padStart(2, "0");
            const dt = new Date(d);
            return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(
                dt.getDate()
            )} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
        };

        const startDate = fmt(openAt);
        const endDate = fmt(closeAt);

        await sequelize.query(
            `UPDATE exams SET 
             duration = ?,
             duration_minutes = ?,
             status = 'published',
             exam_room_code = ?,
             time_open = ?,
             time_close = ?,
             max_points = ?,
             require_face_check = ?,
             require_student_card = ?,
             monitor_screen = ?,
             max_attempts = ?
           WHERE id = ?`,
            {
                replacements: [
                    dur,
                    durMin,
                    room,
                    startDate,
                    endDate,
                    max_points ?? null,
                    require_face_check ? 1 : 0,
                    require_student_card ? 1 : 0,
                    monitor_screen ? 1 : 0,
                    max_attempts ? Number(max_attempts) : 0,
                    examId,
                ],
            }
        );

        console.log(`✅ [OpenExam] Exam ${examId} opened with room ${room}`);

        return res.json({
            ok: true,
            exam_id: examId,
            exam_room_code: room,
            status: "published",
        });
    } catch (err) {
        console.error("instructor/exams/:id/open error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    ensureExamOwnership,
    getExamRow,
    generateRoomCode,
    getMyExams,
    getExamPreview,
    getExamSummary,
    publishExam,
    unpublishExam,
    purgeExam,
    cloneExam,
    openExam,
};
