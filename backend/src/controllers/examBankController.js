const sequelize = require("../config/db");

const importExamQuestions = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { preview, summary, exam_title, duration } = req.body;
    console.log("🕒 duration =", duration);

    const instructorId = req.user.id;

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

    const safeDuration = duration || 60;

    const [[createdByCol], [isBankCol]] = await Promise.all([
      sequelize.query(`SHOW COLUMNS FROM exam_questions LIKE 'created_by'`, {
        transaction,
      }),
      sequelize.query(
        `SHOW COLUMNS FROM exam_questions LIKE 'is_bank_question'`,
        { transaction }
      ),
    ]);

    const hasCreatedBy = Array.isArray(createdByCol) && createdByCol.length > 0;
    const hasIsBank = Array.isArray(isBankCol) && isBankCol.length > 0;

    // ✅ Bắt đầu kiểm tra tổng điểm
    let totalMCQ = 0;
    let totalEssay = 0;
    let mcqCount = 0;
    let essayCount = 0;
    const scorePattern = /\((\d+(?:[.,]\d+)?)đ\)/i; // (0.5đ) hoặc (0,5đ)

    // Duyệt để tính tổng điểm
    for (let i = 0; i < preview.length; i++) {
      const q = preview[i];
      if (!q.question_text) continue;

      const match = q.question_text.match(scorePattern);
      if (!match) {
        await transaction.rollback();
        return res.status(400).json({
          message: `Không xác định được điểm cho câu hỏi dòng ${
            q.row || i + 1
          }. Vui lòng thêm điểm ở dạng "(0.5đ)" hoặc "(0,5đ)" trong câu hỏi.`,
          status: "error",
        });
      }

      const point = parseFloat(match[1].replace(",", "."));
      if (isNaN(point) || point <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: `Điểm không hợp lệ ở dòng ${q.row || i + 1}.`,
          status: "error",
        });
      }

      if (q.type === "MCQ") {
        totalMCQ += point;
        mcqCount++;
      } else if (q.type === "Essay") {
        totalEssay += point;
        essayCount++;
      }
    }

    // ✅ Giới hạn số câu hỏi
    if (mcqCount > 50) {
      await transaction.rollback();
      return res.status(400).json({
        message: `Số lượng câu trắc nghiệm vượt quá giới hạn (tối đa 50, hiện tại ${mcqCount}).`,
        status: "error",
      });
    }

    if (essayCount > 10) {
      await transaction.rollback();
      return res.status(400).json({
        message: `Số lượng câu tự luận vượt quá giới hạn (tối đa 10, hiện tại ${essayCount}).`,
        status: "error",
      });
    }

    // ✅ Tổng điểm phải đúng 10
    const totalPoints = parseFloat((totalMCQ + totalEssay).toFixed(2));
    if (totalPoints !== 10) {
      await transaction.rollback();
      return res.status(400).json({
        message: `Tổng điểm của đề thi hiện tại là ${totalPoints} điểm — yêu cầu tổng điểm phải đúng 10.`,
        status: "error",
      });
    }

    console.log(
      `✅ Tổng điểm hợp lệ: MCQ=${totalMCQ}, Essay=${totalEssay}, Tổng=${totalPoints}`
    );

    // ✅ Lưu exam vào DB
    const [insertRes] = await sequelize.query(
      `INSERT INTO exams (title, instructor_id, duration, status, created_at)
       VALUES (?, ?, ?, 'draft', NOW())`,
      {
        replacements: [exam_title.trim(), instructorId, safeDuration],
        transaction,
      }
    );

    let examId =
      insertRes && typeof insertRes === "object"
        ? insertRes.insertId
        : insertRes;

    if (!examId) {
      const [rows] = await sequelize.query(`SELECT LAST_INSERT_ID() AS id`, {
        transaction,
      });
      examId = Array.isArray(rows) ? rows[0]?.id : rows?.id;
    }

    if (!examId) throw new Error("Không thể tạo bản ghi exam mới");

    let importedCount = 0;
    const errors = [];

    // ✅ Import từng câu hỏi
    for (let i = 0; i < preview.length; i++) {
      const q = preview[i];
      try {
        if (q.errors && q.errors.length > 0) {
          errors.push(`Row ${q.row}: ${q.errors.join(", ")}`);
          continue;
        }

        if (!q.question_text || q.question_text.trim().length === 0) {
          errors.push(`Row ${q.row}: Missing question text`);
          continue;
        }

        // Lấy điểm từng câu hỏi
        const match = q.question_text.match(scorePattern);
        const qPoints = match ? parseFloat(match[1].replace(",", ".")) : 0;

        if (q.type === "MCQ") {
          if (!q.options || q.options.length < 2) {
            errors.push(`Row ${q.row}: MCQ must have at least 2 options`);
            continue;
          }

          if (q.correct_option === null || q.correct_option === undefined) {
            errors.push(`Row ${q.row}: MCQ must have correct answer marked`);
            continue;
          }

          let insertQRes;
          if (hasCreatedBy && hasIsBank) {
            [insertQRes] = await sequelize.query(
              `INSERT INTO exam_questions 
                (exam_id, question_text, type, points, created_by, is_bank_question, created_at) 
               VALUES (?, ?, 'MCQ', ?, ?, TRUE, NOW())`,
              {
                replacements: [
                  examId,
                  q.question_text.trim(),
                  qPoints,
                  instructorId,
                ],
                transaction,
              }
            );
          } else if (hasCreatedBy) {
            [insertQRes] = await sequelize.query(
              `INSERT INTO exam_questions 
                (exam_id, question_text, type, points, created_by, created_at) 
               VALUES (?, ?, 'MCQ', ?, ?, NOW())`,
              {
                replacements: [
                  examId,
                  q.question_text.trim(),
                  qPoints,
                  instructorId,
                ],
                transaction,
              }
            );
          } else {
            [insertQRes] = await sequelize.query(
              `INSERT INTO exam_questions 
                (exam_id, question_text, type, points, created_at) 
               VALUES (?, ?, 'MCQ', ?, NOW())`,
              {
                replacements: [examId, q.question_text.trim(), qPoints],
                transaction,
              }
            );
          }

          const questionId =
            insertQRes && insertQRes.insertId
              ? insertQRes.insertId
              : insertQRes;

          if (!questionId) throw new Error("Failed to insert MCQ question");

          for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
            const optionText = (q.options[optIdx] || "").trim();
            if (!optionText) continue;

            await sequelize.query(
              `INSERT INTO exam_options (question_id, option_text, is_correct) VALUES (?, ?, ?)`,
              {
                replacements: [
                  questionId,
                  optionText,
                  optIdx === q.correct_option ? 1 : 0,
                ],
                transaction,
              }
            );
          }

          importedCount++;
        } else if (q.type === "Essay") {
          if (!q.model_answer || q.model_answer.trim().length === 0) {
            errors.push(`Row ${q.row}: Essay must have model answer`);
            continue;
          }

          let insertQRes;
          if (hasCreatedBy && hasIsBank) {
            [insertQRes] = await sequelize.query(
              `INSERT INTO exam_questions 
                (exam_id, question_text, type, points, model_answer, created_by, is_bank_question, created_at) 
               VALUES (?, ?, 'Essay', ?, ?, ?, TRUE, NOW())`,
              {
                replacements: [
                  examId,
                  q.question_text.trim(),
                  qPoints,
                  q.model_answer.trim(),
                  instructorId,
                ],
                transaction,
              }
            );
          } else if (hasCreatedBy) {
            [insertQRes] = await sequelize.query(
              `INSERT INTO exam_questions 
                (exam_id, question_text, type, points, model_answer, created_by, created_at) 
               VALUES (?, ?, 'Essay', ?, ?, ?, NOW())`,
              {
                replacements: [
                  examId,
                  q.question_text.trim(),
                  qPoints,
                  q.model_answer.trim(),
                  instructorId,
                ],
                transaction,
              }
            );
          } else {
            [insertQRes] = await sequelize.query(
              `INSERT INTO exam_questions 
                (exam_id, question_text, type, points, model_answer, created_at) 
               VALUES (?, ?, 'Essay', ?, ?, NOW())`,
              {
                replacements: [
                  examId,
                  q.question_text.trim(),
                  qPoints,
                  q.model_answer.trim(),
                ],
                transaction,
              }
            );
          }

          importedCount++;
        } else {
          errors.push(`Row ${q.row}: Unknown question type ${q.type}`);
        }
      } catch (err) {
        console.error(`❌ Error importing row ${q.row}:`, err);
        errors.push(`Row ${q.row}: ${err.message}`);
      }
    }

    if (errors.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Import failed, some rows invalid",
        errors,
        status: "error",
      });
    }

    await transaction.commit();

    return res.status(200).json({
      message: `✅ Imported ${importedCount} questions successfully.`,
      exam_id: examId,
      imported: importedCount,
      total_points: totalPoints,
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
