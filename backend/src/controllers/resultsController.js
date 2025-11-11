const sequelize = require('../config/db');

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

async function getSummary(req, res) {
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
    console.error('[resultsController.getSummary] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function getResults(req, res) {
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
      let data = [];
      if (Array.isArray(rows)) data = Array.isArray(rows[0]) ? rows[0] : rows;
      return res.json(data);
    } catch (e) {
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
    console.error('[resultsController.getResults] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function updateScore(req, res) {
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
    try {
      const [rows] = await sequelize.query(`CALL sp_get_exam_results(?, 'instructor', ?);`, { replacements: [examId, req.user.id] });
      const data = Array.isArray(rows) ? (Array.isArray(rows[0])? rows[0] : rows) : [];
      const row = data.find(r => Number(r.student_id) === Number(studentId));
      return res.json(row || { ok: true });
    } catch {
      return res.json({ ok: true });
    }
  } catch (err) {
    console.error('[resultsController.updateScore] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function confirmBulk(req, res) {
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
    const list = Array.isArray(req.body?.items) ? req.body.items : [];
    for (const it of list) {
      const sid = Number(it.studentId);
      const mcq = it.mcq != null ? Number(it.mcq) : null;
      const ai = it.ai != null ? Number(it.ai) : null;
      try { await sequelize.query(`CALL sp_update_student_exam_record(?, ?, ?, ?, ?);`, { replacements: [examId, sid, it.student_name || null, mcq, ai] }); } catch {}
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('[resultsController.confirmBulk] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  getSummary,
  getResults,
  updateScore,
  confirmBulk,
};

