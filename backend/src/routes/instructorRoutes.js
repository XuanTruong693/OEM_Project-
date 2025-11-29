const express = require("express");
const router = express.Router();
const sequelize = require("../config/db");
const { verifyToken, authorizeRole } = require("../middleware/authMiddleware");
const crypto = require('crypto');

// ==============================
// 📊 1️⃣ API: Lấy thống kê tổng
// ==============================
router.get(
  "/dashboard",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      const instructorId = req.user.id;

      const [results] = await sequelize.query(
        `
        SELECT 
          COUNT(DISTINCT e.id) AS total_exams_created,
          COUNT(DISTINCT s.id) AS total_tests_submitted,
          COUNT(DISTINCT s.user_id) AS total_students_participated,
          AVG(s.total_score) AS avg_score
        FROM exams e
        LEFT JOIN submissions s ON s.exam_id = e.id
        WHERE e.instructor_id = ?;
        `,
        { replacements: [instructorId], type: sequelize.QueryTypes.SELECT }
      );

      res.json(results);
    } catch (err) {
      console.error("❌ Error fetching dashboard stats:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// ==============================
// 📋 1b️⃣ API: Danh sách submissions (dùng cho trang con "Xem")
// ==============================
router.get(
  "/dashboard/submissions",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      const instructorId = req.user.id;
      console.log("📋 Fetching submissions for instructor:", instructorId);
      
      const [rows] = await sequelize.query(
        `
        SELECT 
          s.id AS submission_id,
          s.exam_id,
          e.title AS exam_title,
          u.id AS student_id,
          u.full_name AS student_name,
          s.total_score,
          s.ai_score,
          s.suggested_total_score,
          s.status,
          s.attempt_no,
          s.started_at,
          s.submitted_at
        FROM submissions s
        JOIN exams e ON e.id = s.exam_id
        JOIN users u ON u.id = s.user_id
        WHERE e.instructor_id = ?
        ORDER BY s.submitted_at DESC, s.started_at DESC
        `,
        { replacements: [instructorId] }
      );
      
      console.log("✅ Found", rows.length, "submissions");
      return res.json(rows || []);
    } catch (err) {
      console.error("❌ Error fetching submissions list:", err);
      console.error("❌ Error details:", err.message);
      console.error("❌ SQL Error code:", err.original?.code);
      console.error("❌ SQL Error errno:", err.original?.errno);
      return res.status(500).json({ 
        message: "Internal server error",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        sqlCode: process.env.NODE_ENV === 'development' ? err.original?.code : undefined
      });
    }
  }
);

// ==============================
// 👥 1c️⃣ API: Danh sách sinh viên đã tham gia (distinct)
// ==============================
router.get(
  "/dashboard/students",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      const instructorId = req.user.id;
      const [rows] = await sequelize.query(
        `
        SELECT 
          u.id AS student_id,
          u.full_name AS student_name,
          u.email,
          COUNT(s.id) AS submissions_count,
          AVG(s.total_score) AS avg_score,
          MAX(s.submitted_at) AS last_submitted_at
        FROM submissions s
        JOIN exams e ON e.id = s.exam_id
        JOIN users u ON u.id = s.user_id
        WHERE e.instructor_id = ?
        GROUP BY u.id, u.full_name, u.email
        ORDER BY last_submitted_at DESC, submissions_count DESC
        `,
        { replacements: [instructorId] }
      );
      return res.json(rows || []);
    } catch (err) {
      console.error("❌ Error fetching students list:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// =======================================
// 📅 2️⃣ API: Lấy thống kê theo tháng (T1–T12)
// =======================================
router.get(
  "/dashboard/monthly",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      const instructorId = req.user.id;

      const rows = await sequelize.query(
        `
        SELECT 
          MONTH(e.created_at) AS month,
          COUNT(DISTINCT e.id) AS exams_created,
          COUNT(DISTINCT s.user_id) AS students_participated,
          COUNT(DISTINCT s.id) AS total_submissions,
          AVG(s.total_score) AS avg_score
        FROM exams e
        LEFT JOIN submissions s ON s.exam_id = e.id
        WHERE e.instructor_id = ?
        GROUP BY MONTH(e.created_at)
        ORDER BY month;
        `,
        { replacements: [instructorId], type: sequelize.QueryTypes.SELECT }
      );

      const fullMonths = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        return (
          rows.find((r) => r.month === m) || {
            month: m,
            exams_created: 0,
            students_participated: 0,
            total_submissions: 0,
            avg_score: 0,
          }
        );
      });

      res.json(fullMonths);
    } catch (err) {
      console.error("❌ Error fetching monthly stats:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);


// ==============================
// 📄 4️⃣ Instructor: Danh sách đề thi của tôi
// ==============================
router.get(
  "/exams/my",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      const instructorId = req.user.id;
      const [rows] = await sequelize.query(
        `SELECT id, title, status, duration, duration_minutes, time_open, time_close, exam_room_code,
                require_face_check, require_student_card, monitor_screen, max_points
         FROM exams WHERE instructor_id = ? ORDER BY id DESC`,
        { replacements: [instructorId] }
      );
      return res.json(rows || []);
    } catch (err) {
      console.error('instructor/exams/my error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// ==============================
// 📊 7️⃣ Results: Helpers
// ==============================
async function ensureExamOwnership(examId, instructorId) {
  const [rows] = await sequelize.query(
    `SELECT id FROM exams WHERE id = ? AND instructor_id = ? LIMIT 1`,
    { replacements: [examId, instructorId] }
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function getExamRow(examId) {
  const [rows] = await sequelize.query(
    `SELECT id, status, instructor_id FROM exams WHERE id = ? LIMIT 1`,
    { replacements: [examId] }
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// GET /api/instructor/exams/:examId/preview
router.get(
  "/exams/:examId/preview",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      const examId = parseInt(req.params.examId, 10);
      if (!Number.isFinite(examId)) return res.status(400).json({ message: 'examId invalid' });
      // ownership or published view-only
      const ok = await ensureExamOwnership(examId, req.user.id);
      if (!ok) {
        const er = await getExamRow(examId);
        if (!er || String(er.status) !== 'published') {
          return res.status(403).json({ message: 'Not owner of exam' });
        }
      }

      const [rows] = await sequelize.query(
        `SELECT 
            eq.id AS question_id,
            eq.question_text,
            eq.type,
            eq.model_answer,
            eq.points,
            eo.id AS option_id,
            eo.option_text,
            eo.is_correct
         FROM exam_questions eq
         LEFT JOIN exam_options eo ON eo.question_id = eq.id
         WHERE eq.exam_id = ?
         ORDER BY eq.order_index, eq.id, eo.id`,
        { replacements: [examId] }
      );

      const map = new Map();
      for (const r of rows || []) {
        if (!map.has(r.question_id)) {
          map.set(r.question_id, {
            question_id: r.question_id,
            question_text: r.question_text,
            type: r.type,
            model_answer: r.model_answer,
            points: r.points,
            options: [],
          });
        }
        if (r.option_id) {
          map.get(r.question_id).options.push({ option_id: r.option_id, option_text: r.option_text, is_correct: !!r.is_correct });
        }
      }
      return res.json({ exam_id: examId, questions: Array.from(map.values()) });
    } catch (err) {
      console.error('exams/:examId/preview error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /api/instructor/exams/:examId/summary
router.get(
  "/exams/:examId/summary",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      const examId = parseInt(req.params.examId, 10);
      if (!Number.isFinite(examId)) return res.status(400).json({ message: 'examId invalid' });
      const ok = await ensureExamOwnership(examId, req.user.id);
      if (!ok) {
        // allow view-only if exam is published (to reduce friction per request)
        const er = await getExamRow(examId);
        if (!er || String(er.status) !== 'published') {
          return res.status(403).json({ message: 'Not owner of exam' });
        }
      }

      // Try view v_instructor_exam_bank / v_exam_overview
      try {
        const [rows] = await sequelize.query(
          `SELECT * FROM v_instructor_exam_bank WHERE exam_id = ? LIMIT 1`,
          { replacements: [examId] }
        );
        if (Array.isArray(rows) && rows.length) return res.json(rows[0]);
      } catch {}
      try {
        const [rows] = await sequelize.query(
          `SELECT * FROM v_exam_overview WHERE exam_id = ? LIMIT 1`,
          { replacements: [examId] }
        );
        if (Array.isArray(rows) && rows.length) return res.json(rows[0]);
      } catch {}
      // Fallback quick summary
      const [[q1]] = await sequelize.query(
        `SELECT COUNT(*) AS total_submissions, MAX(submitted_at) AS last_submission_time
         FROM submissions WHERE exam_id = ?`, { replacements: [examId] }
      );
      const [[q2]] = await sequelize.query(
        `SELECT COUNT(DISTINCT user_id) AS total_students FROM submissions WHERE exam_id = ?`,
        { replacements: [examId] }
      );
      return res.json({ exam_id: examId, total_submissions: q1?.total_submissions||0, total_students: q2?.total_students||0, last_submission_time: q1?.last_submission_time || null });
    } catch (err) {
      console.error('exams/:examId/summary error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /api/instructor/exams/overview
router.get(
  "/exams/overview",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      try {
        const [rows] = await sequelize.query(
          `SELECT * FROM v_instructor_stats WHERE instructor_id = ?`,
          { replacements: [req.user.id] }
        );
        if (Array.isArray(rows)) return res.json(rows);
      } catch {}
      // Fallback quick stats
      const [[a]] = await sequelize.query(`SELECT COUNT(*) AS total_exams FROM exams WHERE instructor_id = ?`, { replacements: [req.user.id] });
      const [[b]] = await sequelize.query(`SELECT COUNT(*) AS total_submissions, AVG(total_score) AS avg_score FROM submissions s JOIN exams e ON e.id=s.exam_id WHERE e.instructor_id = ?`, { replacements: [req.user.id] });
      const [[c]] = await sequelize.query(`SELECT COUNT(DISTINCT s.user_id) AS total_students FROM submissions s JOIN exams e ON e.id=s.exam_id WHERE e.instructor_id = ?`, { replacements: [req.user.id] });
      return res.json([{ total_exams: a?.total_exams||0, total_submissions: b?.total_submissions||0, avg_score: b?.avg_score||0, total_students: c?.total_students||0 }]);
    } catch (err) {
      console.error('exams/overview error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /api/instructor/exams/:examId/results
router.get(
  "/exams/:examId/results",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      const examId = parseInt(req.params.examId, 10);
      if (!Number.isFinite(examId)) return res.status(400).json({ message: 'examId invalid' });
      const ok = await ensureExamOwnership(examId, req.user.id);
      if (!ok) {
        const er = await getExamRow(examId);
        if (!er || String(er.status) !== 'published') {
          return res.status(403).json({ message: 'Not owner of exam' });
        }
      }

      try {
        const [rows] = await sequelize.query(`CALL sp_get_exam_results(?, 'instructor', ?);`, { replacements: [examId, req.user.id] });
        // mysql2/sequelize for CALL may wrap results in multiple arrays
        let data = [];
        if (Array.isArray(rows)) {
          if (Array.isArray(rows[0])) data = rows[0];
          else data = rows;
        }
        return res.json(data);
      } catch (e) {
        // Fallback: join basics
        const [rows] = await sequelize.query(
          `SELECT 
              u.full_name AS student_name,
              s.user_id AS student_id,
              s.status,
              s.ai_score,
              s.total_score,
              COALESCE(SUM(CASE WHEN q.type='MCQ' THEN COALESCE(sa.score,0) ELSE 0 END),0) AS mcq_score,
              COALESCE(s.suggested_total_score, COALESCE(SUM(CASE WHEN q.type='MCQ' THEN COALESCE(sa.score,0) ELSE 0 END),0) + COALESCE(s.ai_score,0)) AS suggested_total_score,
              s.started_at,
              s.submitted_at,
              TIMESTAMPDIFF(MINUTE, s.started_at, s.submitted_at) AS duration_minutes,
              s.proctor_flags,
              s.face_image_url,
              s.student_card_url
           FROM submissions s 
           JOIN users u ON u.id = s.user_id
           LEFT JOIN student_answers sa ON sa.submission_id = s.id
           LEFT JOIN exam_questions q ON q.id = sa.question_id
           WHERE s.exam_id = ?
           GROUP BY s.id
           ORDER BY u.full_name`, { replacements: [examId] }
        );
        return res.json(rows || []);
      }
    } catch (err) {
      console.error('exams/:examId/results error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// PUT /api/instructor/exams/:examId/students/:studentId/score
router.put(
  "/exams/:examId/students/:studentId/score",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      const examId = parseInt(req.params.examId, 10);
      const studentId = parseInt(req.params.studentId, 10);
      const { mcq_score, ai_score, student_name } = req.body || {};
      if (!Number.isFinite(examId) || !Number.isFinite(studentId)) return res.status(400).json({ message: 'invalid ids' });
      const ok = await ensureExamOwnership(examId, req.user.id);
      if (!ok) {
        const er = await getExamRow(examId);
        if (!er || String(er.status) !== 'published') {
          return res.status(403).json({ message: 'Not owner of exam' });
        }
      }

      const mcq = mcq_score != null ? Number(mcq_score) : null;
      const ai = ai_score != null ? Number(ai_score) : null;
      if ((mcq != null && isNaN(mcq)) || (ai != null && isNaN(ai))) return res.status(400).json({ message: 'score must be number' });

      try {
        await sequelize.query(`CALL sp_update_student_exam_record(?, ?, ?, ?, ?);`, { replacements: [examId, studentId, student_name || null, mcq, ai] });
      } catch (e) {
        // Fallback direct update
        await sequelize.query(
          `UPDATE submissions s SET total_score = ?, ai_score = ?, suggested_total_score = COALESCE(?,0) + COALESCE(?,0), instructor_confirmed = 1, status='confirmed'
           WHERE s.exam_id = ? AND s.user_id = ?`,
          { replacements: [mcq, ai, mcq, ai, examId, studentId] }
        );
        try {
          await sequelize.query(
            `UPDATE results r SET total_score = (SELECT total_score FROM submissions WHERE exam_id=? AND user_id=?), status='confirmed'
             WHERE r.exam_id = ? AND r.student_id = ?`,
            { replacements: [examId, studentId, examId, studentId] }
          );
        } catch {}
      }
      // return updated row
      try {
        const [rows] = await sequelize.query(`CALL sp_get_exam_results(?, 'instructor', ?);`, { replacements: [examId, req.user.id] });
        const data = Array.isArray(rows) ? rows : [];
        const row = data.find(r => Number(r.student_id) === Number(studentId));
        return res.json(row || { ok: true });
      } catch {
        return res.json({ ok: true });
      }
    } catch (err) {
      console.error('PUT score error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// POST /api/instructor/exams/:examId/confirm-bulk
router.post(
  "/exams/:examId/confirm-bulk",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      const examId = parseInt(req.params.examId, 10);
      if (!Number.isFinite(examId)) return res.status(400).json({ message: 'examId invalid' });
      const ok = await ensureExamOwnership(examId, req.user.id);
      if (!ok) return res.status(403).json({ message: 'Not owner of exam' });
      const list = Array.isArray(req.body?.items) ? req.body.items : [];
      for (const it of list) {
        const sid = Number(it.studentId);
        const mcq = it.mcq != null ? Number(it.mcq) : null;
        const ai = it.ai != null ? Number(it.ai) : null;
        try { await sequelize.query(`CALL sp_update_student_exam_record(?, ?, ?, ?, ?);`, { replacements: [examId, sid, it.student_name || null, mcq, ai] }); } catch {}
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error('confirm-bulk error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);
// ==============================
// 🔍 5️⃣ Instructor: Xem preview câu hỏi một đề
// ==============================
router.get(
  "/exams/:id/preview",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      const examId = parseInt(req.params.id, 10);
      const ownerCheck = await sequelize.query(
        `SELECT id FROM exams WHERE id = ? AND instructor_id = ? LIMIT 1`,
        { replacements: [examId, req.user.id] }
      );
      const ok = Array.isArray(ownerCheck[0]) && ownerCheck[0].length > 0;
      if (!ok) return res.status(404).json({ message: 'Exam not found' });

      // questions
      const [qRows] = await sequelize.query(
        `SELECT id AS question_id, question_text, type, points, model_answer FROM exam_questions WHERE exam_id = ? ORDER BY id ASC`,
        { replacements: [examId] }
      );
      const questions = Array.isArray(qRows) ? qRows : [];
      const ids = questions.filter(q => q.type === 'MCQ').map(q => q.question_id);
      let optionsByQ = {};
      if (ids.length) {
        const [oRows] = await sequelize.query(
          `SELECT question_id, id AS option_id, option_text, is_correct FROM exam_options WHERE question_id IN (${ids.map(()=>'?').join(',')}) ORDER BY id ASC`,
          { replacements: ids }
        );
        (Array.isArray(oRows) ? oRows : []).forEach(o => {
          optionsByQ[o.question_id] ||= [];
          optionsByQ[o.question_id].push(o);
        });
      }
      const merged = questions.map(q => q.type === 'MCQ' ? { ...q, options: optionsByQ[q.question_id] || [] } : q);
      return res.json({ exam_id: examId, questions: merged });
    } catch (err) {
      console.error('instructor/exams/:id/preview error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// ==============================
// 🚀 6️⃣ Instructor: Mở phòng thi (publish + cấu hình)
// ==============================
router.post(
  "/exams/:id/open",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      const examId = parseInt(req.params.id, 10);
      const {
        duration,
        duration_minutes,
        time_open,
        time_close,
        max_points,
        require_face_check,
        require_student_card,
        monitor_screen,
      } = req.body || {};

      // owner check
      const [own] = await sequelize.query(`SELECT id FROM exams WHERE id = ? AND instructor_id = ? LIMIT 1`, { replacements: [examId, req.user.id] });
      if (!Array.isArray(own) || own.length === 0) return res.status(404).json({ message: 'Exam not found' });

      // validate time
      const now = new Date();
      const openAt = time_open ? new Date(time_open) : null;
      const closeAt = time_close ? new Date(time_close) : null;
      if (!openAt || !closeAt || isNaN(openAt) || isNaN(closeAt)) {
        return res.status(400).json({ message: 'time_open/time_close invalid' });
      }
      if (openAt.getTime() < now.getTime()) {
        return res.status(400).json({ message: 'time_open must be now or future' });
      }
      if (closeAt.getTime() <= openAt.getTime()) {
        return res.status(400).json({ message: 'time_close must be after time_open' });
      }

      // generate 6-char room code (A-Z0-9)
      const genCode = () => crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();
      let room = genCode();
      try {
        // try ensure uniqueness a few times
        for (let i=0;i<5;i++) {
          const [r] = await sequelize.query(`SELECT 1 FROM exams WHERE exam_room_code = ? LIMIT 1`, { replacements: [room] });
          if (!Array.isArray(r) || r.length === 0) break;
          room = genCode();
        }
      } catch {}

      // build update set, mirror duration into duration_minutes when missing
      const dur = Number(duration || duration_minutes || 0) || null;
      const durMin = Number(duration_minutes || duration || 0) || null;

      const fmt = (d)=> {
        // accept ISO/local datetime; format to 'YYYY-MM-DD HH:MM:SS'
        const pad = (n)=> String(n).padStart(2,'0');
        const dt = new Date(d);
        return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
      };

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
           monitor_screen = ?
         WHERE id = ?`,
        { replacements: [dur, durMin, room, fmt(openAt), fmt(closeAt), (max_points ?? null), (require_face_check?1:0), (require_student_card?1:0), (monitor_screen?1:0), examId] }
      );

      return res.json({ ok: true, exam_id: examId, exam_room_code: room, status: 'published' });
    } catch (err) {
      console.error('instructor/exams/:id/open error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);


// =======================================
// 👤 3️⃣ API: Lấy thông tin user theo ID
// =======================================
router.get("/user/info", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [user] = await sequelize.query(
      "SELECT id, full_name, email, role FROM users WHERE id = ?",
      { replacements: [userId], type: sequelize.QueryTypes.SELECT }
    );

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("❌ Error fetching user info:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
