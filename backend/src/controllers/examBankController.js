const sequelize = require("../config/db");
const XLSX = require("xlsx");

// Endpoint kiểm tra sheets trong file Excel
const checkExcelSheets = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Vui lòng tải lên file Excel",
        status: "error"
      });
    }

    // Đọc file Excel
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return res.status(400).json({
        message: "File Excel không có sheet nào",
        status: "error"
      });
    }

    console.log("📊 File có", workbook.SheetNames.length, "sheets:", workbook.SheetNames);

    // ✅ KIỂM TRA TẤT CẢ SHEETS - Tìm sheets có dữ liệu
    const sheetsWithData = [];

    for (const shName of workbook.SheetNames) {
      const ws = workbook.Sheets[shName];
      const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      // Kiểm tra sheet có dữ liệu thực sự không (ít nhất 2 dòng có nội dung)
      const nonEmptyRows = jsonData.filter(row =>
        row && row.some(cell => cell !== "" && cell !== null && cell !== undefined)
      );

      if (nonEmptyRows.length > 0) {
        sheetsWithData.push({
          name: shName,
          rowCount: nonEmptyRows.length,
          preview: nonEmptyRows.slice(0, 3).map(row =>
            row.filter(cell => cell !== "" && cell !== null && cell !== undefined).slice(0, 5)
          )
        });
      }
    }

    console.log("📄 Sheets có dữ liệu:", sheetsWithData.length, sheetsWithData.map(s => s.name));

    // Nếu không có sheet nào có dữ liệu
    if (sheetsWithData.length === 0) {
      return res.status(400).json({
        message: "File Excel không chứa dữ liệu trong bất kỳ sheet nào",
        status: "error"
      });
    }

    // Nếu chỉ có 1 sheet có dữ liệu → Trả về sheet đó để FE parse
    if (sheetsWithData.length === 1) {
      return res.status(200).json({
        status: "single_sheet",
        message: "File có 1 sheet chứa dữ liệu",
        selectedSheet: sheetsWithData[0].name,
        data: null
      });
    }

    // Nếu có nhiều hơn 1 sheet có dữ liệu → Yêu cầu user chọn
    return res.status(200).json({
      status: "multiple_sheets",
      message: `File có ${sheetsWithData.length} sheets chứa dữ liệu. Vui lòng chọn sheet cần import.`,
      sheets: sheetsWithData,
      data: null
    });

  } catch (error) {
    console.error("Error checking Excel sheets:", error);
    return res.status(500).json({
      message: "Lỗi khi kiểm tra file Excel: " + error.message,
      status: "error"
    });
  }
};

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
        .json({ message: "Tên đề thi là bắt buộc", status: "error" });
    }

    if (!Array.isArray(preview) || preview.length === 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "Không có câu hỏi để import", status: "error" });
    }

    // ✅ 1. Kiểm tra câu hỏi trùng lặp
    const duplicateErrors = [];
    const seenQuestions = new Map();

    preview.forEach((q, idx) => {
      if (!q.question_text) return;

      // ✅ Auto-detect Essay based on markers/content (User Request)
      // If "model_answer" is present and no options, treat as Essay
      if ((!q.type || q.type === 'MCQ') && q.model_answer && (!q.options || q.options.length < 2)) {
        q.type = 'Essay';
      }

      // Loại bỏ đánh số câu tự động và normalize
      const cleanedText = q.question_text.replace(/^Câu\s+\d+:\s*/i, "").trim();
      const normalizedText = cleanedText.toLowerCase().replace(/\s+/g, " ").trim();

      if (seenQuestions.has(normalizedText)) {
        const previousRows = seenQuestions.get(normalizedText);
        duplicateErrors.push(
          `Câu hỏi trùng lặp tại dòng ${q.row || idx + 1} và dòng ${previousRows.join(", ")}: "${cleanedText.substring(0, 50)}${cleanedText.length > 50 ? "..." : ""}"`
        );
        previousRows.push(q.row || idx + 1);
      } else {
        seenQuestions.set(normalizedText, [q.row || idx + 1]);
      }
    });

    if (duplicateErrors.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: "❌ Phát hiện câu hỏi trùng lặp!\n\n" + duplicateErrors.join("\n") + "\n\nVui lòng xóa các câu hỏi trùng lặp và thử lại.",
        status: "error",
        duplicates: duplicateErrors
      });
    }

    // ✅ 2. Kiểm tra xem có câu hỏi nào chứa dữ liệu không phải text thuần túy
    for (let i = 0; i < preview.length; i++) {
      const q = preview[i];

      // Kiểm tra question_text
      if (q.question_text && typeof q.question_text === 'object') {
        await transaction.rollback();
        return res.status(400).json({
          message: "File chứa các file hình ảnh, âm thanh không đúng định dạng. Vui lòng sửa lại theo mẫu hướng dẫn.",
          status: "error"
        });
      }

      // Kiểm tra model_answer cho Essay
      if (q.model_answer && typeof q.model_answer === 'object') {
        await transaction.rollback();
        return res.status(400).json({
          message: "File chứa các file hình ảnh, âm thanh không đúng định dạng. Vui lòng sửa lại theo mẫu hướng dẫn.",
          status: "error"
        });
      }

      // Kiểm tra options cho MCQ
      if (q.options && Array.isArray(q.options)) {
        for (let opt of q.options) {
          if (opt && typeof opt === 'object') {
            await transaction.rollback();
            return res.status(400).json({
              message: "File chứa các file hình ảnh, âm thanh không đúng định dạng. Vui lòng sửa lại theo mẫu hướng dẫn.",
              status: "error"
            });
          }
        }
      }
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
    const scorePattern = /\((\d+(?:[.,]\d+)?)\s*(?:đ|points?)\)/i;

    // Duyệt để tính tổng điểm
    for (let i = 0; i < preview.length; i++) {
      const q = preview[i];
      if (!q.question_text) continue;

      const match = q.question_text.match(scorePattern);
      if (!match) {
        await transaction.rollback();
        return res.status(400).json({
          message: `Không xác định được điểm số cho câu hỏi ở dòng ${q.row || i + 1
            }. Vui lòng thêm điểm số theo định dạng "(0.5đ)" hoặc "(0,5đ)" trong nội dung câu hỏi.`,
          status: "error",
        });
      }

      const point = parseFloat(match[1].replace(",", "."));
      if (isNaN(point) || point <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: `Điểm số không hợp lệ ở dòng ${q.row || i + 1}.`,
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

    // ✅ Tổng điểm phải đúng 10
    const totalPoints = preview.reduce((sum, q) => {
      const match = q.question_text?.match(scorePattern);
      if (!match)
        throw new Error(`Cannot determine score for row ${q.row || "?"}`);
      const point = parseFloat(match[1].replace(",", "."));
      return sum + point;
    }, 0);

    // ✅ Tổng điểm phải đúng 10 (không sai số)
    const tolerance = 0.00001;
    if (Math.abs(totalPoints - 10) > tolerance) {
      await transaction.rollback();
      return res.status(400).json({
        message: `Tổng điểm phải bằng chính xác 10đ (Hiện tại: ${totalPoints.toFixed(3)}đ). Vui lòng điều chỉnh lại điểm các câu hỏi.`,
        status: "error",
      });
    }

    console.log(
      `✅ Validation hợp lệ: ${mcqCount} câu MCQ + ${essayCount} câu Essay = ${totalPoints.toFixed(2)} điểm`
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

    if (!examId) throw new Error("Cannot create a new exam record.");

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
          errors.push(`Dòng ${q.row}: Thiếu nội dung câu hỏi`);
          continue;
        }

        // Lấy điểm từng câu hỏi
        const match = q.question_text.match(scorePattern);
        const qPoints = match ? parseFloat(match[1].replace(",", ".")) : 0;

        if (q.type === "MCQ") {
          if (!q.options || q.options.length < 2) {
            errors.push(`Dòng ${q.row}: Câu trắc nghiệm phải có ít nhất 2 đáp án`);
            continue;
          }

          if (q.correct_option === null || q.correct_option === undefined) {
            errors.push(`Dòng ${q.row}: Câu trắc nghiệm phải có đáp án đúng được đánh dấu`);
            continue;
          }

          let insertQRes;
          if (hasCreatedBy && hasIsBank) {
            [insertQRes] = await sequelize.query(
              `INSERT INTO exam_questions 
                (exam_id, question_text, type, points, model_answer, created_by, is_bank_question, created_at) 
               VALUES (?, ?, 'MCQ', ?, ?, ?, TRUE, NOW())`,
              {
                replacements: [
                  examId,
                  q.question_text.trim(),
                  qPoints,
                  q.model_answer ? q.model_answer.trim() : null,
                  instructorId,
                ],
                transaction,
              }
            );
          } else if (hasCreatedBy) {
            [insertQRes] = await sequelize.query(
              `INSERT INTO exam_questions 
                (exam_id, question_text, type, points, model_answer, created_by, created_at) 
               VALUES (?, ?, 'MCQ', ?, ?, ?, NOW())`,
              {
                replacements: [
                  examId,
                  q.question_text.trim(),
                  qPoints,
                  q.model_answer ? q.model_answer.trim() : null,
                  instructorId,
                ],
                transaction,
              }
            );
          } else {
            [insertQRes] = await sequelize.query(
              `INSERT INTO exam_questions 
                (exam_id, question_text, type, points, model_answer, created_at) 
               VALUES (?, ?, 'MCQ', ?, ?, NOW())`,
              {
                replacements: [examId, q.question_text.trim(), qPoints, q.model_answer ? q.model_answer.trim() : null],
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
            errors.push(`Dòng ${q.row}: Câu tự luận phải có câu trả lời mẫu`);
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
          errors.push(`Dòng ${q.row}: Loại câu hỏi không xác định ${q.type}`);
        }
      } catch (err) {
        console.error(`❌ Lỗi import dòng ${q.row}:`, err);
        errors.push(`Dòng ${q.row}: ${err.message}`);
      }
    }

    if (errors.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Import thất bại, một số dòng không hợp lệ",
        errors,
        status: "error",
      });
    }

    await transaction.commit();

    return res.status(200).json({
      message: `✅ Import thành công ${importedCount} câu hỏi.`,
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
      message: "Lỗi máy chủ khi import: " + err.message,
      status: "error",
    });
  }
};

module.exports = { checkExcelSheets, importExamQuestions };
