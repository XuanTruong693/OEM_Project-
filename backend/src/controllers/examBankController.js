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

    console.log("DEBUG:", { exam_title, instructorId, duration });
    const [_, metadata] = await sequelize.query(
      `INSERT INTO exams (title, instructor_id, duration, status, created_at)
   VALUES (?, ?, ?, 'draft', NOW())`,
      {
        replacements: [exam_title.trim(), instructorId, safeDuration],
        transaction,
      }
    );

    const examId = metadata?.insertId;
    if (!examId) throw new Error("Không thể tạo bản ghi exam mới");

    let importedCount = 0;
    const errors = [];

    for (let i = 0; i < preview.length; i++) {
      const q = preview[i];
      try {
        // Skip nếu dòng có lỗi validation FE
        if (q.errors && q.errors.length > 0) {
          errors.push(`Row ${q.row}: ${q.errors.join(", ")}`);
          continue;
        }

        if (!q.question_text || q.question_text.trim().length === 0) {
          errors.push(`Row ${q.row}: Missing question text`);
          continue;
        }

        if (q.type === "MCQ") {
          if (!q.options || q.options.length < 2) {
            errors.push(`Row ${q.row}: MCQ must have at least 2 options`);
            continue;
          }

          if (q.correct_option === null || q.correct_option === undefined) {
            errors.push(`Row ${q.row}: MCQ must have correct answer marked`);
            continue;
          }

          const [insertQRes] = await sequelize.query(
            `INSERT INTO exam_questions 
              (exam_id, question_text, type, points, created_by, is_bank_question, created_at) 
             VALUES (?, ?, 'MCQ', 1, ?, TRUE, NOW())`,
            {
              replacements: [examId, q.question_text.trim(), instructorId],
              transaction,
            }
          );

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

          const [insertQRes] = await sequelize.query(
            `INSERT INTO exam_questions 
              (exam_id, question_text, type, points, model_answer, created_by, is_bank_question, created_at) 
             VALUES (?, ?, 'Essay', 2, ?, ?, TRUE, NOW())`,
            {
              replacements: [
                examId,
                q.question_text.trim(),
                q.model_answer.trim(),
                instructorId,
              ],
              transaction,
            }
          );

          const questionId =
            insertQRes && insertQRes.insertId
              ? insertQRes.insertId
              : insertQRes;

          if (!questionId) throw new Error("Failed to insert Essay question");

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
      message: `Successfully imported ${importedCount} questions.`,
      exam_id: examId,
      imported: importedCount,
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
