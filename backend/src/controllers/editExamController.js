const sequelize = require("../config/db");
const { QueryTypes } = require("sequelize");

// Time helpers
const parseTs = (v) => (v ? new Date(String(v).replace(" ", "T")) : null);
const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());
const isInProgressWindow = (open, close) => {
  const o = parseTs(open);
  const c = parseTs(close);
  if (!isValidDate(o) || !isValidDate(c)) return false;
  const now = new Date();
  return now >= o && now <= c;
};
const isExpiredWindow = (close) => {
  const c = parseTs(close);
  return isValidDate(c) && c < new Date();
};

const getExamForEdit = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const instructorId = req.user.id;

    const [exam] = await sequelize.query(
      `SELECT id, title, duration, status, time_open, time_close 
       FROM exams 
       WHERE id = :id AND instructor_id = :instructorId`,
      {
        replacements: { id, instructorId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    if (!exam) {
      await transaction.rollback();
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy đề thi.",
      });
    }

    // Kiểm tra đang thi theo khoảng thời gian
    const inProgress = isInProgressWindow(exam.time_open, exam.time_close);

    // Nếu bài thi đang trong quá trình thi thì không thể sửa
    if (inProgress) {
      await transaction.rollback();
      return res.status(400).json({
        status: "error",
        message: "Không thể chỉnh sửa đề thi đang trong thời gian mở phòng.",
      });
    }

    // Tiếp tục lấy thông tin câu hỏi và các tùy chọn cho bài thi
    const questions = await sequelize.query(
      `SELECT 
          id,
          question_text AS content,
          type,
          points,
          order_index,
          model_answer AS modelAnswer
       FROM exam_questions 
       WHERE exam_id = :examId
       ORDER BY order_index, id`,
      { replacements: { examId: id }, type: QueryTypes.SELECT, transaction }
    );
    
    const questionsWithOptions = await Promise.all(
      questions.map(async (q) => {
        if (q.type === "MCQ") {
          const options = await sequelize.query(
            `SELECT id, option_text AS content, is_correct 
             FROM exam_options 
             WHERE question_id = :qid
             ORDER BY id`,
            {
              replacements: { qid: q.id },
              type: QueryTypes.SELECT,
              transaction,
            }
          );
          return { ...q, options };
        }
        return { ...q, options: [] };
      })
    );

    await transaction.commit();

    res.json({
      id: exam.id,
      title: exam.title,
      duration: exam.duration,
      questions: questionsWithOptions,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Lỗi khi lấy thông tin bài thi:", error);
    res.status(500).json({ status: "error", message: "Lỗi máy chủ." });
  }
};


// ============================
// Cập nhật đề thi
// ============================
const updateExam = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const instructorId = req.user.id;
    const { title, duration, questions } = req.body;

    if (!title?.trim()) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ status: "error", message: "Tiêu đề không được để trống." });
    }

    const totalPoints = questions.reduce(
      (sum, q) => sum + (parseFloat(q.points) || 0),
      0
    );

    if (Math.round(totalPoints * 10) / 10 !== 10) {
      await transaction.rollback();
      return res.status(400).json({
        status: "error",
        message: `Tổng điểm hiện tại là ${totalPoints.toFixed(
          1
        )}. Tổng điểm tất cả câu hỏi phải bằng 10.`,
      });
    }

    const exam = await sequelize.query(
      `SELECT status, time_open, time_close 
       FROM exams 
       WHERE id = :id AND instructor_id = :instructorId`,
      {
        replacements: { id, instructorId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    if (!exam || exam.length === 0) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ status: "error", message: "Không tìm thấy đề thi." });
    }

    let resetToDraft = false;
    if (exam[0].status === "published") {
      const inProgress = isInProgressWindow(exam[0].time_open, exam[0].time_close);
      if (inProgress) {
        await transaction.rollback();
        return res.status(400).json({
          status: "error",
          message: "Không thể sửa đề thi đang trong thời gian mở phòng.",
        });
      }
      // Nếu đã hết hạn (có close và quá hạn) thì chuyển về draft sau khi lưu
      if (isExpiredWindow(exam[0].time_close)) resetToDraft = true;
    }

    if (exam[0].status === 'draft') {
   
      try {
        await sequelize.query(
          `UPDATE exams SET title = ?, duration = ?, updated_at = NOW() WHERE id = ?`,
          { replacements: [title, duration || null, id], type: QueryTypes.UPDATE, transaction }
        );
      } catch (uErr) {
        console.error('❌ Error updating exam row (draft):', uErr);
        throw uErr;
      }

      // delete existing questions/options for this exam and insert new ones
      await sequelize.query(`DELETE FROM exam_options WHERE question_id IN (SELECT id FROM exam_questions WHERE exam_id = ?)`, { replacements: [id], transaction }).catch(()=>{});
      await sequelize.query(`DELETE FROM exam_questions WHERE exam_id = ?`, { replacements: [id], transaction }).catch(()=>{});

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const type = q.type?.toLowerCase() === "essay" ? "essay" : "MCQ";
        const modelAnswer = type === "essay" ? q.modelAnswer || null : null;

        const [questionId] = await sequelize.query(
          `INSERT INTO exam_questions (exam_id, question_text, type, points, order_index, model_answer) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          {
            replacements: [id, q.content, type, q.points, i, modelAnswer],
            type: QueryTypes.INSERT,
            transaction,
          }
        );

        if (type === "MCQ" && q.options?.length > 0) {
          for (const opt of q.options) {
            await sequelize.query(
              `INSERT INTO exam_options (question_id, option_text, is_correct) VALUES (?, ?, ?)`,
              {
                replacements: [questionId, opt.content, opt.is_correct ? 1 : 0],
                transaction,
              }
            );
          }
        }
      }

      await transaction.commit();
      return res.json({ status: 'success', message: 'Đã cập nhật đề thi (draft).', exam_id: id });
    }

    // Otherwise (published/archived) -> create a clone and keep original intact
    const [origRows] = await sequelize.query(
      `SELECT instructor_id, duration, duration_minutes, max_points, require_face_check, require_student_card, monitor_screen, max_attempts
       FROM exams WHERE id = ? LIMIT 1`,
      { replacements: [id], type: QueryTypes.SELECT, transaction }
    );
    const orig = Array.isArray(origRows) ? origRows[0] : origRows || {};

    const [insExam] = await sequelize.query(
      `INSERT INTO exams (instructor_id, title, duration, duration_minutes, max_points, require_face_check, require_student_card, monitor_screen, max_attempts, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NOW(), NOW())`,
      {
        replacements: [
          instructorId,
          title,
          duration || orig.duration || null,
          orig.duration_minutes || null,
          orig.max_points || null,
          orig.require_face_check ? 1 : 0,
          orig.require_student_card ? 1 : 0,
          orig.monitor_screen ? 1 : 0,
          orig.max_attempts || 0,
        ],
        type: QueryTypes.INSERT,
        transaction,
      }
    );
    const newExamId = insExam?.insertId || insExam;

    // Copy câu hỏi và options từ payload vào exam mới
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const type = q.type?.toLowerCase() === "essay" ? "essay" : "MCQ";
      const modelAnswer = type === "essay" ? q.modelAnswer || null : null;

      const [questionId] = await sequelize.query(
        `INSERT INTO exam_questions (exam_id, question_text, type, points, order_index, model_answer) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        {
          replacements: [newExamId, q.content, type, q.points, i, modelAnswer],
          type: QueryTypes.INSERT,
          transaction,
        }
      );

      if (type === "MCQ" && q.options?.length > 0) {
        for (const opt of q.options) {
          await sequelize.query(
            `INSERT INTO exam_options (question_id, option_text, is_correct) VALUES (?, ?, ?)`,
            {
              replacements: [questionId, opt.content, opt.is_correct ? 1 : 0],
              transaction,
            }
          );
        }
      }
    }

    await transaction.commit();
    return res.json({
      status: "success",
      message: "Đã tạo bản sao đề thi mới và giữ nguyên đề cũ.",
      exam_id: newExamId,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating exam:", error);
    res
      .status(500)
      .json({ status: "error", message: "Lỗi máy chủ khi cập nhật." });
  }
};

module.exports = { getExamForEdit, updateExam };
