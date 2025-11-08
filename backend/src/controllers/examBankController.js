const sequelize = require("../config/db");
const { QueryTypes } = require("sequelize");
const bcrypt = require("bcrypt");
const { insertExam, insertExamQuestion, normalizeQuestionType } = require("../utils/schemaHelper");

// Ensure we have a valid instructor/admin user id to satisfy FK on exams.instructor_id
async function ensureInstructorId(transaction, candidateId) {
  try {
    if (candidateId) {
      const user = await sequelize.query(
        `SELECT id FROM users WHERE id = ? LIMIT 1`,
        { replacements: [candidateId], type: QueryTypes.SELECT, transaction }
      );
      if (user && user.length > 0) return candidateId;
    }

    // Reuse any existing instructor/admin if present
    const fallbackUser = await sequelize.query(
      `SELECT id FROM users WHERE role IN ('instructor','admin') ORDER BY id ASC LIMIT 1`,
      { type: QueryTypes.SELECT, transaction }
    );
    if (fallbackUser && fallbackUser.length > 0) return fallbackUser[0].id;

    // Create a minimal admin user automatically (no email verification required)
    const email = `admin+${Date.now()}@local.test`;
    const hashed = await bcrypt.hash("TempAdmin#123", 10);
    const res = await sequelize.query(
      `INSERT INTO users (full_name, email, password_hash, role, created_at) VALUES (?, ?, ?, 'admin', NOW())`,
      { replacements: ["System Admin", email, hashed], transaction, type: QueryTypes.INSERT }
    );
    // Try to get new id
    let newId = (res?.[1]?.insertId) || (res?.[0]?.insertId) || res?.[0];
    if (!newId) {
      const row = await sequelize.query(`SELECT LAST_INSERT_ID() AS id`, { type: QueryTypes.SELECT, transaction });
      newId = row?.[0]?.id || row?.id;
    }
    if (!newId) {
      const q = await sequelize.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, { replacements: [email], type: QueryTypes.SELECT, transaction });
      newId = q?.[0]?.id;
    }
    return newId;
  } catch (e) {
    // If all else fails, return null and let caller handle
    return null;
  }
}

const importExamQuestions = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { preview, summary, exam_title } = req.body;
    const instructorId = req.user?.id;
    // Chỉ cho phép instructor/admin thật của request; không fallback sang user khác
    if (!instructorId) {
      await transaction.rollback();
      return res.status(401).json({ message: "Missing user context", status: "error" });
    }

    if (!exam_title || exam_title.trim().length === 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "exam_title is required", status: "error" });
    }

    if (!Array.isArray(preview) || preview.length === 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "No questions to import", status: "error" });
    }

    // Tạo exam dùng helper thích ứng schema
    let examId;
    try {
      examId = await insertExam(
        sequelize,
        {
          title: exam_title.trim(),
          instructor_id: instructorId,
          duration_minutes: 60,
          status: 'draft',
        },
        transaction
      );
    } catch (e) {
      await transaction.rollback();
      console.error('❌ Insert exam failed:', e);
      return res.status(500).json({
        message: 'Insert exam failed: ' + (e.message || 'Unknown error'),
        status: 'error',
      });
    }

    if (!examId) throw new Error("Không thể tạo bản ghi exam mới");

  // Lưu NGUYÊN FILE thành 1 đề trong kho (để tra cứu/khôi phục)
  // Dùng bảng import_jobs + import_rows (đã có sẵn trong schema) để cất JSON câu hỏi
    const jobUUID = `job_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

    // Tạo job
    const jobRes = await sequelize.query(
      `INSERT INTO import_jobs (job_uuid, exam_id, created_by, status, preview_json, result_summary, created_at, updated_at)
       VALUES (?, ?, ?, 'completed', ?, ?, NOW(), NOW())`,
      {
        replacements: [
          jobUUID,
          examId,
          instructorId || null,
          JSON.stringify(preview),
          JSON.stringify(summary)
        ],
        transaction,
        type: QueryTypes.INSERT,
      }
    );

    let jobId = (jobRes?.[1]?.insertId) || (jobRes?.[0]?.insertId) || jobRes?.[0];
    if (!jobId) {
      const row = await sequelize.query(`SELECT LAST_INSERT_ID() AS id`, { type: QueryTypes.SELECT, transaction });
      jobId = row?.[0]?.id || row?.id;
    }

    // Ghi từng dòng vào import_rows (để tra cứu/khôi phục sau này)
    for (let i = 0; i < preview.length; i++) {
      const q = preview[i];
      await sequelize.query(
        `INSERT INTO import_rows (job_id, \`row_number\`, row_data, errors, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        {
          replacements: [
            jobId,
            q.row || i + 1,
            JSON.stringify(q),
            q?.errors && q.errors.length ? JSON.stringify(q.errors) : null,
          ],
          transaction,
        }
      );
    }

    // ĐỒNG THỜI ghi câu hỏi thật sự vào exam_questions + exam_options
    // để danh sách và màn hình chỉnh sửa hiển thị được ngay
    let insertedQuestions = 0;
    for (let i = 0; i < preview.length; i++) {
      const raw = preview[i] || {};
      const normType = normalizeQuestionType(raw.type);

      // Bỏ qua dòng lỗi nếu có errors
      if (Array.isArray(raw.errors) && raw.errors.length > 0) continue;

      const qId = await insertExamQuestion(
        sequelize,
        {
          exam_id: examId,
          question_text: (raw.question_text || '').toString(),
          type: normType,
          model_answer: normType === 'Essay' ? (raw.model_answer || null) : null,
          points: 1,
          order_index: i + 1,
          created_by: instructorId,
          is_bank_question: true,
        },
        transaction
      );

      if (qId) {
        insertedQuestions++;
        // Nếu là MCQ thì thêm các options
        if (normType === 'MCQ' && Array.isArray(raw.options)) {
          for (let oi = 0; oi < raw.options.length; oi++) {
            const optText = (raw.options[oi] || '').toString();
            const isCorrect = (raw.correct_option !== undefined && raw.correct_option !== null) ? (oi === Number(raw.correct_option)) : false;
            await sequelize.query(
              `INSERT INTO exam_options (question_id, option_text, is_correct) VALUES (?, ?, ?)`,
              { replacements: [qId, optText, isCorrect ? 1 : 0], transaction }
            );
          }
        }
      }
    }

    await transaction.commit();

    return res.status(200).json({
      message: `✅ Đã lưu 1 đề vào kho và ghi ${insertedQuestions}/${preview.length} câu vào hệ thống`,
      exam_id: examId,
      job_id: jobId,
      imported: insertedQuestions,
      summary,
      status: "success",
    });
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Import error:", err);
    return res.status(500).json({
      message: "Server error during import: " + err.message,
      status: "error",
    });
  }
};

module.exports = { importExamQuestions };
// List recent imported exam files (jobs)
const listRecentImports = async (req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT j.id AS job_id, j.job_uuid, j.status, j.created_at, j.updated_at, j.result_summary,
              e.id AS exam_id, e.title AS exam_title
       FROM import_jobs j
       JOIN exams e ON e.id = j.exam_id
       ORDER BY j.id DESC
       LIMIT 20`,
      { type: QueryTypes.SELECT }
    );
    return res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('listRecentImports error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

// Get raw rows for a specific job (to verify what was saved)
const getImportRows = async (req, res) => {
  try {
    const { jobId } = req.params;
    const rows = await sequelize.query(
      `SELECT id, \`row_number\` AS row_number, row_data, errors, created_at
       FROM import_rows
       WHERE job_id = ?
       ORDER BY \`row_number\` ASC`,
      { replacements: [jobId], type: QueryTypes.SELECT }
    );
    return res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('getImportRows error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

// Fetch the latest saved "file" (JSON) for a given exam_id
const getExamFile = async (req, res) => {
  try {
    const { examId } = req.params;
    const job = await sequelize.query(
      `SELECT id AS job_id, job_uuid, exam_id, preview_json, result_summary, created_at
       FROM import_jobs
       WHERE exam_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      { replacements: [examId], type: QueryTypes.SELECT }
    );
    if (!job || job.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No saved file for this exam' });
    }
    return res.json({ status: 'success', data: job[0] });
  } catch (err) {
    console.error('getExamFile error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

module.exports = { importExamQuestions, listRecentImports, getImportRows, getExamFile };
