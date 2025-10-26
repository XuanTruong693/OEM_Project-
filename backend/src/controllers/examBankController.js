const { User } = require("../models/User");
const sequelize = require("../config/db");

// Import exam questions from Excel preview
const importExamQuestions = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { preview, summary } = req.body;
    const instructorId = req.user.id;

    console.log('📥 [Exam Bank] Import request from instructor:', instructorId);
    console.log('📊 Summary:', summary);
    console.log('📋 Preview sample:', JSON.stringify(preview[0], null, 2));

    if (!preview || !Array.isArray(preview) || preview.length === 0) {
      return res.status(400).json({
        message: 'No questions to import',
        status: 'error'
      });
    }

    let importedCount = 0;
    const errors = [];

    for (let i = 0; i < preview.length; i++) {
      const q = preview[i];

      try {
        // Skip if has frontend validation errors
        if (q.errors && q.errors.length > 0) {
          console.log(`⚠️ Skipping row ${q.row} - has validation errors`);
          errors.push(`Row ${q.row}: ${q.errors.join(', ')}`);
          continue;
        }

        // Validate question
        if (!q.question_text || q.question_text.trim().length === 0) {
          errors.push(`Row ${q.row}: Missing question text`);
          continue;
        }

        if (q.type === 'MCQ') {
          // Validate MCQ
          if (!q.options || q.options.length < 2) {
            errors.push(`Row ${q.row}: MCQ must have at least 2 options`);
            continue;
          }
          if (q.correct_option === null || q.correct_option === undefined) {
            errors.push(`Row ${q.row}: MCQ must have correct answer marked`);
            continue;
          }

          // Insert MCQ question using Sequelize raw query
          const [result] = await sequelize.query(
            `INSERT INTO exam_questions 
             (exam_id, question_text, type, points, created_by, is_bank_question, created_at) 
             VALUES (NULL, ?, 'MCQ', 1, ?, TRUE, NOW())`,
            {
              replacements: [q.question_text.trim(), instructorId],
              transaction,
            }
          );

          const questionId = result; // Sequelize returns insertId directly

          console.log(`✅ Inserted MCQ question ID: ${questionId}`);

          // Insert options
          for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
            const optionText = (q.options[optIdx] || '').trim();
            if (!optionText) continue;

            await sequelize.query(
              `INSERT INTO exam_options 
               (question_id, option_text, is_correct) 
               VALUES (?, ?, ?)`,
              {
                replacements: [
                  questionId,
                  optionText,
                  optIdx === q.correct_option ? 1 : 0
                ],
                transaction,
              }
            );
          }

          importedCount++;
          console.log(`✅ Row ${q.row} - MCQ imported successfully`);

        } else if (q.type === 'Essay') {
          // Validate Essay
          if (!q.model_answer || q.model_answer.trim().length === 0) {
            errors.push(`Row ${q.row}: Essay must have model answer`);
            continue;
          }

          // Insert Essay question
          const [result] = await sequelize.query(
            `INSERT INTO exam_questions 
             (exam_id, question_text, type, points, model_answer, created_by, is_bank_question, created_at) 
             VALUES (NULL, ?, 'Essay', 2, ?, ?, TRUE, NOW())`,
            {
              replacements: [q.question_text.trim(), q.model_answer.trim(), instructorId],
              transaction,
            }
          );

          const questionId = result;

          console.log(`✅ Inserted Essay question ID: ${questionId}`);
          importedCount++;
          console.log(`✅ Row ${q.row} - Essay imported successfully`);
        }

      } catch (err) {
        console.error(`❌ Error importing question at row ${q.row}:`, err);
        errors.push(`Row ${q.row}: ${err.message}`);
      }
    }

    // Decision: Rollback if any errors, or commit if success
    if (errors.length > 0) {
      await transaction.rollback();
      console.error('❌ [Exam Bank] Import failed with errors:', errors);
      return res.status(400).json({
        message: `Failed to import ${errors.length} questions`,
        errors: errors,
        status: 'error'
      });
    }

    await transaction.commit();
    console.log(`✅ [Exam Bank] Successfully imported ${importedCount} questions`);

    res.json({
      message: `Successfully imported ${importedCount} questions`,
      imported: importedCount,
      summary: summary,
      status: 'success'
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ [Exam Bank] Import error:', error);
    res.status(500).json({
      message: 'Server error during import: ' + error.message,
      status: 'error'
    });
  }
};

module.exports = {
  importExamQuestions
};