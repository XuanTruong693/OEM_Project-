const sequelize = require("../config/db");
const { QueryTypes } = require("sequelize");

// ============================
// 1. Lấy danh sách đề thi (paginated + search + filter)
// ============================
const getExams = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { page = 1, limit = 10, search = "", status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE e.instructor_id = :instructorId";
    const replacements = {
      instructorId,
      limit: parseInt(limit),
      offset,
      search: `%${search}%`,
    };

    if (status && status !== "Tất cả") {
      whereClause += " AND e.status = :status";
      replacements.status = status;
    }

    if (search) {
      whereClause += " AND e.title LIKE :search";
    }

    const query = `
      SELECT e.id, e.title, e.duration, e.status, e.exam_room_code,
             e.time_open, e.time_close,
             e.created_at, e.updated_at
      FROM exams e
      ${whereClause}
      ORDER BY e.updated_at DESC
      LIMIT :limit OFFSET :offset
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM exams e
      ${whereClause}
    `;

    const [exams, countResult] = await Promise.all([
      sequelize.query(query, { replacements, type: QueryTypes.SELECT }),
      sequelize.query(countQuery, { replacements, type: QueryTypes.SELECT }),
    ]);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      status: "success",
      data: exams,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching exams:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

// ============================
// 2. Lấy chi tiết đề thi
// ============================
const getExamDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const instructorId = req.user.id;

    const [exam] = await sequelize.query(
      `SELECT * FROM exams WHERE id = :id AND instructor_id = :instructorId`,
      { replacements: { id, instructorId }, type: QueryTypes.SELECT }
    );

    if (!exam) {
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy đề thi",
      });
    }

    // LẤY CÂU HỎI TỪ BẢNG exam_questions
    const questions = await sequelize.query(
      `
      SELECT 
        eq.id,
        eq.question_text,
        eq.type,
        eq.points,
        eq.model_answer
      FROM exam_questions eq
      WHERE eq.exam_id = :examId
      ORDER BY eq.order_index, eq.id
      `,
      { replacements: { examId: id }, type: QueryTypes.SELECT }
    );

    // LẤY ĐÁP ÁN CHO TRẮC NGHIỆM
    const questionsWithOptions = await Promise.all(
      questions.map(async (q) => {
        if (q.type === "MCQ") {
          const options = await sequelize.query(
            `SELECT id, option_text, is_correct FROM exam_options WHERE question_id = :qid`,
            { replacements: { qid: q.id }, type: QueryTypes.SELECT }
          );
          return { ...q, options };
        }
        return q;
      })
    );

    exam.questions = questionsWithOptions;

    res.json({
      status: "success",
      data: exam,
    });
  } catch (error) {
    console.error("Error fetching exam details:", error);
    res.status(500).json({
      status: "error",
      message: "Lỗi máy chủ",
    });
  }
};

const deleteExam = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const instructorId = req.user.id;
    const [exam] = await sequelize.query(
      `SELECT id, title, status, time_open, time_close FROM exams WHERE id = :id AND instructor_id = :instructorId`,
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
        message: "Không tìm thấy đề thi hoặc bạn không có quyền xóa.",
      });
    }
    if (exam.status === "published") {
      const now = new Date();
      const open = exam.time_open ? new Date(String(exam.time_open).replace(' ', 'T')) : null;
      const close = exam.time_close ? new Date(String(exam.time_close).replace(' ', 'T')) : null;
      const inProgress = open instanceof Date && close instanceof Date && !isNaN(open) && !isNaN(close) && now >= open && now <= close;
      if (inProgress) {
        await transaction.rollback();
        return res.status(400).json({
          status: "error",
          message: "Không thể xóa đề thi đang trong thời gian mở phòng.",
        });
      }
    }
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
    await sequelize.query(`DELETE FROM exams WHERE id = ?`, {
      replacements: [id],
      transaction,
    });
    await transaction.commit();
    return res.json({
      status: "success",
      message: `Đã xóa đề thi "${exam.title}" thành công.`,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error deleting exam:", error);
    return res.status(500).json({
      status: "error",
      message: "Lỗi máy chủ khi xóa đề thi. Vui lòng thử lại.",
    });
  }
};

// cập nhật
const publishExam = async (req, res) => {
  try {
    const { id } = req.params;
    const instructorId = req.user.id;

    const [exam] = await sequelize.query(
      `SELECT * FROM exams WHERE id = :id AND instructor_id = :instructorId`,
      { replacements: { id, instructorId }, type: QueryTypes.SELECT }
    );

    if (!exam) {
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy đề thi hoặc bạn không có quyền",
      });
    }

    if (exam.status === "published") {
      return res.status(400).json({
        status: "error",
        message: "Đề thi đã được mở phòng",
      });
    }

    const examRoomCode = `EXAM${Date.now()}`;

    await sequelize.query(
      `UPDATE exams SET status = 'published', exam_room_code = ?, updated_at = NOW() WHERE id = ?`,
      { replacements: [examRoomCode, id] }
    );

    res.json({
      status: "success",
      message: "Mở phòng thi thành công",
      data: { exam_room_code: examRoomCode },
    });
  } catch (error) {
    console.error("Error publishing exam:", error);
    res.status(500).json({
      status: "error",
      message: "Lỗi máy chủ",
    });
  }
};

module.exports = {
  getExams,
  getExamDetails,
  deleteExam,
  publishExam,
};
