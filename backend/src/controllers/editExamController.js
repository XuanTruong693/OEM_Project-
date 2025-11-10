// controllers/editExamController.js
const sequelize = require("../config/db");
const { QueryTypes } = require("sequelize");

// ============================
// Lấy chi tiết đề thi để chỉnh sửa
// ============================
const getExamForEdit = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const instructorId = req.user.id;

    const [exam] = await sequelize.query(
      `SELECT id, title, duration, status 
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

    if (exam.status === "published") {
      await transaction.rollback();
      return res.status(400).json({
        status: "error",
        message: "Không thể chỉnh sửa đề thi đã mở phòng.",
      });
    }

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
    console.error("Error fetching exam for edit:", error);
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
      `SELECT status 
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

    if (exam[0].status === "published") {
      await transaction.rollback();
      return res.status(400).json({
        status: "error",
        message: "Không thể sửa đề thi đã mở phòng.",
      });
    }

    // Cập nhật thông tin đề thi
    await sequelize.query(
      `UPDATE exams SET title = ?, duration = ?, updated_at = NOW() WHERE id = ?`,
      { replacements: [title, duration, id], transaction }
    );

    // Xóa câu hỏi và option cũ
    await sequelize.query(
      `DELETE eo FROM exam_options eo 
       INNER JOIN exam_questions eq ON eo.question_id = eq.id 
       WHERE eq.exam_id = ?`,
      { replacements: [id], transaction }
    );
    await sequelize.query(`DELETE FROM exam_questions WHERE exam_id = ?`, {
      replacements: [id],
      transaction,
    });

    // Thêm lại câu hỏi mới
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
    res.json({
      status: "success",
      message: "Cập nhật đề thi thành công!",
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
