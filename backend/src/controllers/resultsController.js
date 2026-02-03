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
    console.log(`🔍 [DEBUG] getSummary hit for examId=${examId}`);
    if (!Number.isFinite(examId)) return res.status(400).json({ message: 'examId invalid' });
    const ok = await ensureExamOwnership(examId, req.user.id);
    if (!ok) {
      const er = await getExamRow(examId);
      if (!er || String(er.status) !== 'published') {
        return res.status(403).json({ message: 'Not owner of exam' });
      }
    }

    // Always fetch last_submission_time directly for reliability
    const [[timeResult]] = await sequelize.query(
      `SELECT MAX(submitted_at) AS last_submission_time FROM submissions WHERE exam_id = ?`,
      { replacements: [examId] }
    );
    const lastSubmissionTime = timeResult?.last_submission_time || null;

    // Also fetch avg_score for the summary
    const [[avgResult]] = await sequelize.query(
      `SELECT AVG(total_score + COALESCE(ai_score, 0)) AS avg_score FROM submissions WHERE exam_id = ? AND status IN ('graded', 'confirmed')`,
      { replacements: [examId] }
    );
    const avgScore = avgResult?.avg_score || null;

    console.log(`🔍 [DEBUG] Exam ${examId}: lastSub=${lastSubmissionTime}, avg=${avgScore}`);

    try {
      const [rows] = await sequelize.query(
        `SELECT * FROM v_instructor_exam_bank WHERE exam_id = ? LIMIT 1`,
        { replacements: [examId] }
      );
      if (Array.isArray(rows) && rows.length) {
        console.log(`🔍 [DEBUG] Found in v_instructor_exam_bank. Keys:`, Object.keys(rows[0]));
        // Merge last_submission_time and avg_score into the result and return
        const finalData = {
          ...rows[0],
          last_submission_time: rows[0].last_submission_time || lastSubmissionTime,
          avg_score: rows[0].avg_score ?? avgScore
        };
        console.log(`🔍 [DEBUG] Final Data Keys:`, Object.keys(finalData));
        return res.json(finalData);
      }
    } catch (err) { console.error('View 1 error:', err); }
    try {
      const [rows] = await sequelize.query(
        `SELECT * FROM v_exam_overview WHERE exam_id = ? LIMIT 1`,
        { replacements: [examId] }
      );
      if (Array.isArray(rows) && rows.length) {
        // Merge last_submission_time and avg_score into the result
        return res.json({
          ...rows[0],
          last_submission_time: rows[0].last_submission_time || lastSubmissionTime,
          avg_score: rows[0].avg_score ?? avgScore
        });
      }
    } catch { }

    const [[q1]] = await sequelize.query(
      `SELECT COUNT(*) AS total_submissions FROM submissions WHERE exam_id = ?`,
      { replacements: [examId] }
    );
    const [[q2]] = await sequelize.query(
      `SELECT COUNT(DISTINCT user_id) AS total_students FROM submissions WHERE exam_id = ?`,
      { replacements: [examId] }
    );
    return res.json({
      exam_id: examId,
      total_submissions: q1?.total_submissions || 0,
      total_students: q2?.total_students || 0,
      last_submission_time: lastSubmissionTime,
      avg_score: avgScore
    });
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
      // Fallback query: Hiển thị ĐIỂM CAO NHẤT của mỗi student
      const [rows] = await sequelize.query(
        `SELECT 
            u.full_name AS student_name,
            s.user_id AS student_id,
            COUNT(DISTINCT s.id) AS total_attempts,
            MAX(s.total_score) AS best_score,
            MAX(s.total_score) AS total_score,
            GROUP_CONCAT(DISTINCT s.id ORDER BY s.total_score DESC SEPARATOR ',') AS submission_ids,
            GROUP_CONCAT(DISTINCT s.attempt_no ORDER BY s.total_score DESC SEPARATOR ',') AS attempt_numbers,
            (SELECT status FROM submissions WHERE user_id = s.user_id AND exam_id = s.exam_id ORDER BY total_score DESC, submitted_at DESC LIMIT 1) AS status,
            (SELECT ai_score FROM submissions WHERE user_id = s.user_id AND exam_id = s.exam_id ORDER BY total_score DESC, submitted_at DESC LIMIT 1) AS ai_score,
            (SELECT suggested_total_score FROM submissions WHERE user_id = s.user_id AND exam_id = s.exam_id ORDER BY total_score DESC, submitted_at DESC LIMIT 1) AS suggested_total_score,
            (SELECT started_at FROM submissions WHERE user_id = s.user_id AND exam_id = s.exam_id ORDER BY total_score DESC, submitted_at DESC LIMIT 1) AS started_at,
            (SELECT submitted_at FROM submissions WHERE user_id = s.user_id AND exam_id = s.exam_id ORDER BY total_score DESC, submitted_at DESC LIMIT 1) AS submitted_at,
            (SELECT face_image_url FROM submissions WHERE user_id = s.user_id AND exam_id = s.exam_id ORDER BY total_score DESC, submitted_at DESC LIMIT 1) AS face_image_url,
            (SELECT student_card_url FROM submissions WHERE user_id = s.user_id AND exam_id = s.exam_id ORDER BY total_score DESC, submitted_at DESC LIMIT 1) AS student_card_url,
            (SELECT proctor_flags FROM submissions WHERE user_id = s.user_id AND exam_id = s.exam_id ORDER BY total_score DESC, submitted_at DESC LIMIT 1) AS proctor_flags
         FROM submissions s 
         JOIN users u ON u.id = s.user_id
         WHERE s.exam_id = ? AND s.status = 'graded'
         GROUP BY s.user_id, u.full_name
         ORDER BY best_score DESC, u.full_name`, { replacements: [examId] }
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

    // LOGIC: Chỉ cập nhật nếu điểm mới cao hơn điểm hiện tại
    const newTotalScore = (mcq || 0) + (ai || 0);

    const [currentBest] = await sequelize.query(
      `SELECT MAX(total_score) AS best_score 
       FROM submissions 
       WHERE exam_id = ? AND user_id = ? AND status = 'graded'`,
      { replacements: [examId, studentId] }
    );

    const currentBestScore = currentBest[0]?.best_score || 0;

    console.log(`📊 [updateScore] Instructor updating score:`, {
      exam_id: examId,
      student_id: studentId,
      new_score: newTotalScore,
      current_best: currentBestScore,
      will_update: newTotalScore > currentBestScore
    });

    if (newTotalScore > currentBestScore) {
      try {
        await sequelize.query(`CALL sp_update_student_exam_record(?, ?, ?, ?, ?);`, { replacements: [examId, studentId, student_name || null, mcq, ai] });
      } catch (e) {
        await sequelize.query(
          `UPDATE submissions s 
           SET total_score = ?, ai_score = ?, suggested_total_score = COALESCE(?,0) + COALESCE(?,0), instructor_confirmed = 1, status='confirmed'
           WHERE s.exam_id = ? AND s.user_id = ?
           ORDER BY total_score DESC, submitted_at DESC
           LIMIT 1`,
          { replacements: [mcq, ai, mcq, ai, examId, studentId] }
        );
        try {
          await sequelize.query(
            `UPDATE results r SET total_score = (SELECT MAX(total_score) FROM submissions WHERE exam_id=? AND user_id=?), status='confirmed'
             WHERE r.exam_id = ? AND r.student_id = ?`,
            { replacements: [examId, studentId, examId, studentId] }
          );
        } catch { }
      }
      console.log(`✅ [updateScore] Score updated to ${newTotalScore} (previous best: ${currentBestScore})`);
    } else {
      console.log(`ℹ️ [updateScore] Score NOT updated. New score ${newTotalScore} <= current best ${currentBestScore}`);
    }

    try {
      const [rows] = await sequelize.query(`CALL sp_get_exam_results(?, 'instructor', ?);`, { replacements: [examId, req.user.id] });
      const data = Array.isArray(rows) ? (Array.isArray(rows[0]) ? rows[0] : rows) : [];
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
      try { await sequelize.query(`CALL sp_update_student_exam_record(?, ?, ?, ?, ?);`, { replacements: [examId, sid, it.student_name || null, mcq, ai] }); } catch { }
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

