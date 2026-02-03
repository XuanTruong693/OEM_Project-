const express = require("express");
const router = express.Router();
const sequelize = require("../config/db");
const { verifyToken, authorizeRole } = require("../middleware/authMiddleware");

// Import controllers
const {
  getDashboardStats,
  getDashboardSubmissions,
  getDashboardStudents,
  getDashboardMonthly,
  getMyExams,
  getExamPreview,
  getExamSummary,
  publishExam,
  unpublishExam,
  getExamSubmissions,
  getSubmissionAnswers,
  gradeAnswer,
  confirmAIScore,
  finalizeSubmission,
  retryFailedGrading,
  purgeExam,
  cloneExam,
  openExam,
  approveAllExamScores,
  updateStudentAnswerScore,
  updateStudentExamScore,
} = require("../controllers/instructor");
const submissionController = require("../controllers/submissionController");

// Middleware shorthand
const auth = [verifyToken, authorizeRole(["instructor"])];

// ==============================
// 📊 Dashboard APIs
// ==============================
router.get("/dashboard", ...auth, getDashboardStats);
router.get("/dashboard/submissions", ...auth, getDashboardSubmissions);
router.get("/dashboard/students", ...auth, getDashboardStudents);
router.get("/dashboard/monthly", ...auth, getDashboardMonthly);

// ==============================
// 📄 Exam Management APIs
// ==============================
router.get("/exams/my", ...auth, getMyExams);
router.get("/exams/:examId/preview", ...auth, getExamPreview);
router.get("/exams/:examId/summary", ...auth, getExamSummary);
router.post("/exams/:examId/publish", ...auth, publishExam);
router.post("/exams/:examId/unpublish", ...auth, unpublishExam);
router.post("/exams/:examId/purge", ...auth, purgeExam);
router.post("/exams/:examId/clone", ...auth, cloneExam);
router.post("/exams/:examId/open", ...auth, openExam);

// ==============================
// 📝 Grading APIs
// ==============================
router.get("/exams/:examId/submissions", ...auth, getExamSubmissions);
router.get("/submissions/:submissionId/answers", ...auth, getSubmissionAnswers);
router.put("/answers/:answerId/grade", ...auth, gradeAnswer);
router.post("/answers/:answerId/confirm-ai", ...auth, confirmAIScore);
router.post("/grading/retry-failed", ...auth, retryFailedGrading);
router.post("/grading/:submissionId/finalize", ...auth, finalizeSubmission);
// POST /api/instructor/exams/:examId/approve-all-scores
// RESTORED: Exact original inline handler
router.post(
  "/exams/:examId/approve-all-scores",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      const examId = parseInt(req.params.examId, 10);
      if (!Number.isFinite(examId))
        return res.status(400).json({ message: "examId invalid" });

      const { ensureExamOwnership } = require("../controllers/instructor");
      const ok = await ensureExamOwnership(examId, req.user.id);
      if (!ok) {
        return res.status(403).json({ message: "Not owner of exam" });
      }

      console.log(`📝 [ApproveAll] Starting bulk approval for exam ${examId}`);

      // Update all submissions: copy suggested_total_score to total_score, set instructor_confirmed=1
      const [result] = await sequelize.query(
        `UPDATE submissions 
         SET total_score = suggested_total_score,
             instructor_confirmed = 1,
             status = 'confirmed'
         WHERE exam_id = ? 
           AND instructor_confirmed = 0`,
        { replacements: [examId] }
      );

      const approvedCount = result.affectedRows || 0;
      console.log(
        `✅ [ApproveAll] Approved ${approvedCount} submissions for exam ${examId}`
      );

      return res.json({
        success: true,
        approved: approvedCount,
        message: `Đã duyệt ${approvedCount} bài thi`,
      });
    } catch (err) {
      console.error("❌ [ApproveAll] Error:", err);
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
  }
);

// PUT /api/instructor/exams/:examId/students/:studentId/score
// RESTORED: Exact original inline handler
router.put(
  "/exams/:examId/students/:studentId/score",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      const examId = parseInt(req.params.examId, 10);
      const studentId = parseInt(req.params.studentId, 10);
      const { total_score, ai_score, student_name } = req.body || {};

      if (!Number.isFinite(examId) || !Number.isFinite(studentId))
        return res.status(400).json({ message: "invalid ids" });

      const { ensureExamOwnership } = require("../controllers/instructor");
      const ok = await ensureExamOwnership(examId, req.user.id);
      if (!ok) {
        return res.status(403).json({ message: "Not owner of exam" });
      }

      const mcq = total_score != null ? Number(total_score) : null;
      const ai = ai_score != null ? Number(ai_score) : null;
      if ((mcq != null && isNaN(mcq)) || (ai != null && isNaN(ai)))
        return res.status(400).json({ message: "score must be number" });

      try {
        await sequelize.query(
          `CALL sp_update_student_exam_record(?, ?, ?, ?, ?);`,
          { replacements: [examId, studentId, student_name || null, mcq, ai] }
        );
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
        } catch { }
      }
      // return updated row
      try {
        const [rows] = await sequelize.query(
          `CALL sp_get_exam_results(?, 'instructor', ?);`,
          { replacements: [examId, req.user.id] }
        );
        const data = Array.isArray(rows) ? rows : [];
        const row = data.find(
          (r) => Number(r.student_id) === Number(studentId)
        );
        return res.json(row || { ok: true });
      } catch {
        return res.json({ ok: true });
      }
    } catch (err) {
      console.error("PUT score error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.put("/submissions/:submissionId/answers/:answerId/score", ...auth, updateStudentAnswerScore);
router.get("/exams/:examId/admin-modified", ...auth, async (req, res) => {
  try {
    const examId = parseInt(req.params.examId, 10);
    if (!Number.isFinite(examId))
      return res.status(400).json({ message: "examId invalid" });

    const { ensureExamOwnership } = require("../controllers/instructor");
    const ok = await ensureExamOwnership(examId, req.user.id);
    if (!ok) return res.status(403).json({ message: "Access denied" });

    // Check if any modifications happened recently (last 30 seconds)
    const [[result]] = await sequelize.query(
      `SELECT updated_at FROM exams WHERE id = ? LIMIT 1`,
      { replacements: [examId] }
    );

    const wasModified = result && result.updated_at &&
      (new Date() - new Date(result.updated_at)) < 30000;

    return res.json({
      modified: wasModified,
      updated_at: result?.updated_at || null
    });
  } catch (err) {
    console.error("admin-modified error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Get submissions count (for real-time polling)
router.get("/exams/:examId/submissions/count", ...auth, async (req, res) => {
  try {
    const examId = parseInt(req.params.examId, 10);
    const lastCount = parseInt(req.query.lastCount, 10) || 0;

    if (!Number.isFinite(examId))
      return res.status(400).json({ message: "examId invalid" });

    const [[result]] = await sequelize.query(
      `SELECT COUNT(*) AS count FROM submissions WHERE exam_id = ?`,
      { replacements: [examId] }
    );

    const currentCount = result?.count || 0;
    const hasNew = currentCount > lastCount;

    return res.json({
      count: currentCount,
      hasNew,
      lastCount
    });
  } catch (err) {
    console.error("submissions/count error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Check exam status (for real-time updates)
router.get("/exams/:examId/check-status", ...auth, async (req, res) => {
  try {
    const examId = parseInt(req.params.examId, 10);
    if (!Number.isFinite(examId))
      return res.status(400).json({ message: "examId invalid" });

    const [[exam]] = await sequelize.query(
      `SELECT status, time_open, time_close, updated_at FROM exams WHERE id = ? LIMIT 1`,
      { replacements: [examId] }
    );

    if (!exam) return res.status(404).json({ message: "Exam not found" });

    // Calculate if exam is currently active
    const now = new Date();
    const timeOpen = exam.time_open ? new Date(exam.time_open) : null;
    const timeClose = exam.time_close ? new Date(exam.time_close) : null;

    let isActive = exam.status === 'published';
    if (timeOpen && now < timeOpen) isActive = false;
    if (timeClose && now > timeClose) isActive = false;

    return res.json({
      status: exam.status,
      time_open: exam.time_open,
      time_close: exam.time_close,
      updated_at: exam.updated_at,
      is_active: isActive
    });
  } catch (err) {
    console.error("check-status error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


// Long polling for new submissions count
router.get("/exams/:examId/submissions/poll", ...auth, async (req, res) => {
  const examId = parseInt(req.params.examId, 10);
  const lastCount = parseInt(req.query.lastCount, 10) || 0;
  const timeout = 25000;
  const checkInterval = 1000;

  if (!Number.isFinite(examId))
    return res.status(400).json({ message: "examId invalid" });

  const startTime = Date.now();

  async function checkCount() {
    const [[{ cnt }]] = await sequelize.query(
      `SELECT COUNT(*) AS cnt FROM submissions WHERE exam_id = ?`,
      { replacements: [examId] }
    );
    return cnt;
  }

  async function poll() {
    const current = await checkCount();
    if (current !== lastCount || Date.now() - startTime > timeout) {
      return res.json({ count: current });
    }
    setTimeout(poll, checkInterval);
  }

  try {
    await poll();
  } catch (err) {
    console.error("Long polling error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Get exam results with details
// Batch grade multiple answers
router.post("/submissions/:submissionId/batch-grade", ...auth, async (req, res) => {
  try {
    const submissionId = parseInt(req.params.submissionId, 10);
    const { grades } = req.body; // Array of { answer_id, score, feedback }

    if (!Number.isFinite(submissionId) || !Array.isArray(grades)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    // Check ownership
    const [[sub]] = await sequelize.query(
      `SELECT exam_id FROM submissions WHERE id = ?`,
      { replacements: [submissionId] }
    );

    if (!sub) return res.status(404).json({ message: "Submission not found" });

    const { ensureExamOwnership } = require("../controllers/instructor");
    const ok = await ensureExamOwnership(sub.exam_id, req.user.id);
    if (!ok) return res.status(403).json({ message: "Access denied" });

    // Update each answer
    for (const g of grades) {
      if (g.answer_id && typeof g.score === "number") {
        await sequelize.query(
          `UPDATE student_answers 
           SET score = ?, instructor_feedback = ?, status = 'graded', graded_at = NOW()
           WHERE id = ? AND submission_id = ?`,
          { replacements: [g.score, g.feedback || null, g.answer_id, submissionId] }
        );
      }
    }

    // Recalculate total
    await sequelize.query(
      `UPDATE submissions 
       SET total_score = (
         SELECT COALESCE(SUM(sa.score), 0) 
         FROM student_answers sa
         JOIN exam_questions q ON q.id = sa.question_id
         WHERE sa.submission_id = ? AND q.type = 'MCQ'
       ),
           status = 'graded'
       WHERE id = ?`,
      { replacements: [submissionId, submissionId] }
    );

    return res.json({ message: "Grades saved", count: grades.length });
  } catch (err) {
    console.error("batchGrade error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Export statistics
router.get("/exams/:examId/export", ...auth, async (req, res) => {
  try {
    const examId = parseInt(req.params.examId, 10);
    if (!Number.isFinite(examId))
      return res.status(400).json({ message: "examId invalid" });

    const { ensureExamOwnership } = require("../controllers/instructor");
    const ok = await ensureExamOwnership(examId, req.user.id);
    if (!ok) return res.status(403).json({ message: "Access denied" });

    const [rows] = await sequelize.query(
      `
      SELECT 
        u.full_name AS "Họ tên",
        u.email AS "Email",
        s.attempt_no AS "Lần thi",
        s.total_score AS "Điểm MCQ",
        s.ai_score AS "Điểm Essay",
        s.suggested_total_score AS "Tổng điểm",
        s.status AS "Trạng thái",
        s.submitted_at AS "Thời gian nộp"
      FROM submissions s
      JOIN users u ON u.id = s.user_id
      WHERE s.exam_id = ?
      ORDER BY u.full_name, s.attempt_no
      `,
      { replacements: [examId] }
    );

    return res.json(rows || []);
  } catch (err) {
    console.error("exportExamResults error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


// Get exam results list
router.get("/exams/:examId/results", ...auth, submissionController.getExamResults);

// Get submission detail
router.get("/submissions/:submissionId/detail", ...auth, submissionController.getStudentExamDetail);

// Get cheating details
router.get("/submissions/:submissionId/cheating-details", ...auth, submissionController.getStudentCheatingDetails);

// Get submission questions
router.get("/submissions/:submissionId/questions", ...auth, submissionController.getSubmissionQuestions);

// Get Face Image
router.get("/submissions/:submissionId/face-image", ...auth, async (req, res) => {
  try {
    const submissionId = parseInt(req.params.submissionId, 10);
    const [rows] = await sequelize.query(
      `SELECT face_image_blob, face_image_mimetype FROM submissions WHERE id = ?`,
      { replacements: [submissionId] }
    );
    if (!rows || rows.length === 0 || !rows[0].face_image_blob) {
      return res.status(404).send("Image not found");
    }
    res.setHeader("Content-Type", rows[0].face_image_mimetype || "image/jpeg");
    res.send(rows[0].face_image_blob);
  } catch (err) {
    console.error("face-image error:", err);
    res.status(500).send("Server Error");
  }
});

// Get Student Card Image
router.get("/submissions/:submissionId/student-card", ...auth, async (req, res) => {
  try {
    const submissionId = parseInt(req.params.submissionId, 10);
    const [rows] = await sequelize.query(
      `SELECT student_card_blob, student_card_mimetype FROM submissions WHERE id = ?`,
      { replacements: [submissionId] }
    );
    if (!rows || rows.length === 0 || !rows[0].student_card_blob) {
      return res.status(404).send("Image not found");
    }
    res.setHeader("Content-Type", rows[0].student_card_mimetype || "image/jpeg");
    res.send(rows[0].student_card_blob);
  } catch (err) {
    console.error("student-card error:", err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
