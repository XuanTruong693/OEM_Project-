const sequelize = require("../config/db");
const { QueryTypes } = require("sequelize");
const XLSX = require('xlsx');
const multer = require('multer');

// Helper function to validate datetime
const isValidDateTime = (dateString) => {
  try {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && date.toISOString() === dateString;
  } catch {
    return false;
  }
};

// Lấy danh sách tất cả đề thi của instructor
const getExams = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = "WHERE e.instructor_id = :instructorId";
    const replacements = { instructorId, limit: parseInt(limit), offset };
    
    if (status) {
      whereClause += " AND e.status = :status";
      replacements.status = status;
    }
    
    if (search) {
      whereClause += " AND e.title LIKE :search";
      replacements.search = `%${search}%`;
    }
    
    const query = `
      SELECT 
        e.id,
        e.title,
        e.duration AS duration,
        e.exam_room_code,
        e.status,
        e.created_at,
        e.updated_at,
        u.full_name as instructor_name,
        COUNT(DISTINCT eq.id) as total_questions,
        COUNT(DISTINCT s.id) as total_submissions,
        AVG(s.total_score) as avg_score
      FROM exams e
      LEFT JOIN users u ON e.instructor_id = u.id
      LEFT JOIN exam_questions eq ON e.id = eq.exam_id
      LEFT JOIN submissions s ON e.id = s.exam_id AND s.status = 'confirmed'
      ${whereClause}
      GROUP BY e.id, u.full_name
      ORDER BY e.updated_at DESC
      LIMIT :limit OFFSET :offset
    `;
    
    const countQuery = `
      SELECT COUNT(DISTINCT e.id) as total
      FROM exams e
      ${whereClause}
    `;
    
    const [exams, countResult] = await Promise.all([
      sequelize.query(query, { replacements, type: QueryTypes.SELECT }),
      sequelize.query(countQuery, { replacements, type: QueryTypes.SELECT })
    ]);
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      status: "success",
      data: {
        exams,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    // Gửi thêm chi tiết lỗi để debug nhanh (chỉ nên dùng khi dev)
    console.error("Error fetching exams:", error);
    res.status(500).json({ 
      message: "Server error",
      status: "error",
      debug: error?.message || null,
      sql: error?.parent?.sql || undefined
    });
  }
};

// Lấy thông tin chi tiết một đề thi
const getExamDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const instructorId = req.user.id;
    
    // Lấy thông tin cơ bản của đề thi
    const examQuery = `
      SELECT 
        e.id,
        e.title,
        e.duration AS duration,
        e.exam_room_code,
        e.status,
        e.created_at,
        e.updated_at,
        COUNT(DISTINCT eq.id) as total_questions,
        COUNT(DISTINCT s.id) as total_submissions,
        AVG(s.total_score) as avg_score,
        SUM(eq.points) as total_points
      FROM exams e
      LEFT JOIN exam_questions eq ON e.id = eq.exam_id
      LEFT JOIN submissions s ON e.id = s.exam_id AND s.status = 'confirmed'
      WHERE e.id = :examId AND e.instructor_id = :instructorId
      GROUP BY e.id
    `;
    
    const [exam] = await sequelize.query(examQuery, {
      replacements: { examId: id, instructorId },
      type: QueryTypes.SELECT
    });
    
    if (!exam) {
      return res.status(404).json({ 
        message: "Exam not found or you don't have permission", 
        status: "error" 
      });
    }
    
    // Lấy danh sách câu hỏi (row-based như cũ)
    const questionsQuery = `
      SELECT 
        eq.*,
        GROUP_CONCAT(
          JSON_OBJECT(
            'id', eo.id,
            'option_text', eo.option_text,
            'is_correct', eo.is_correct
          )
        ) as options
      FROM exam_questions eq
      LEFT JOIN exam_options eo ON eq.id = eo.question_id
      WHERE eq.exam_id = :examId
      GROUP BY eq.id
      ORDER BY eq.order_index ASC, eq.id ASC
    `;
    
    const questions = await sequelize.query(questionsQuery, {
      replacements: { examId: id },
      type: QueryTypes.SELECT
    });
    
    // Parse options JSON
    questions.forEach(question => {
      if (question.options) {
        try {
          question.options = JSON.parse(`[${question.options}]`);
        } catch (e) {
          question.options = [];
        }
      } else {
        question.options = [];
      }
    });
    
    exam.questions = questions;
    
    res.json({
      status: "success",
      data: exam
    });
  } catch (error) {
    console.error("Error fetching exam details:", error);
    res.status(500).json({ message: "Server error", status: "error" });
  }
};

// Tạo đề thi mới
const createExam = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const instructorId = req.user.id;
    const { 
      title, 
      duration = 60, 
      questions = [], 
      status = 'draft' 
    } = req.body;
    
    // Validate input
    if (!title || title.trim().length === 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: "Title is required", 
        status: "error" 
      });
    }
    
    if (!duration || duration <= 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: "Duration must be greater than 0", 
        status: "error" 
      });
    }
    
    // Tạo exam
    const [_, metadata] = await sequelize.query(
      `INSERT INTO exams (title, instructor_id, duration, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      { 
        replacements: [
          title.trim(), 
          instructorId, 
          duration, 
          status
        ], 
        transaction 
      }
    );
    
    const examId = metadata.insertId;
    
    // Thêm câu hỏi nếu có
    if (questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        const [__, questionMetadata] = await sequelize.query(
          `INSERT INTO exam_questions (exam_id, question_text, type, model_answer, points, order_index, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          {
            replacements: [
              examId,
              question.question_text,
              question.type,
              question.model_answer || null,
              question.points || 1,
              question.order_index || i + 1
            ],
            transaction
          }
        );
        
        const questionId = questionMetadata.insertId;
        
        // Thêm options cho MCQ
        if (question.type === 'MCQ' && question.options && question.options.length > 0) {
          for (const option of question.options) {
            await sequelize.query(
              `INSERT INTO exam_options (question_id, option_text, is_correct)
               VALUES (?, ?, ?)`,
              {
                replacements: [questionId, option.option_text, option.is_correct || false],
                transaction
              }
            );
          }
        }
      }
    }
    
    await transaction.commit();
    
    // Lấy thông tin exam vừa tạo để trả về
    const [createdExam] = await sequelize.query(
      `SELECT id, title, status, duration, created_at
       FROM exams 
       WHERE id = ?`,
      { 
        replacements: [examId],
        type: QueryTypes.SELECT 
      }
    );
    
    res.status(201).json({
      status: "success",
      message: "Exam created successfully",
      exam: {
        id: createdExam.id,
        title: createdExam.title,
        status: createdExam.status,
        duration: createdExam.duration,
        created_at: createdExam.created_at
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating exam:", error);
    res.status(500).json({ message: "Server error", status: "error" });
  }
};

// Cập nhật đề thi
const updateExam = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const instructorId = req.user.id;
    const { title, duration, questions, status } = req.body;
    const idNum = Number(id);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "Invalid exam id", status: "error" });
    }
    
    // Basic validations
    if (title !== undefined && (!title || title.trim().length === 0)) {
      await transaction.rollback();
      return res.status(400).json({ message: "Title is required", status: "error" });
    }
    if (duration !== undefined) {
      const d = Number(duration);
      if (!Number.isFinite(d) || d <= 0) {
        await transaction.rollback();
        return res.status(400).json({ message: "Duration must be a positive number", status: "error" });
      }
    }

    // Kiểm tra quyền sở hữu
    const [exam] = await sequelize.query(
      "SELECT id FROM exams WHERE id = :examId AND instructor_id = :instructorId",
      { replacements: { examId: idNum, instructorId }, type: QueryTypes.SELECT, transaction }
    );
    
    if (!exam) {
      await transaction.rollback();
      return res.status(404).json({ 
        message: "Exam not found or you don't have permission", 
        status: "error" 
      });
    }
    
    // Cập nhật thông tin exam
    const updateFields = [];
    const replacements = [];
    
    if (title !== undefined) {
      updateFields.push("title = ?");
      replacements.push(title.trim());
    }
    if (duration !== undefined) {
      updateFields.push("duration = ?");
      replacements.push(duration);
    }
    if (status !== undefined) {
      updateFields.push("status = ?");
      replacements.push(status);
    }
    
    updateFields.push("updated_at = NOW()");
    replacements.push(id);
    
    if (updateFields.length > 1) {
      await sequelize.query(
        `UPDATE exams SET ${updateFields.join(", ")} WHERE id = ?`,
        { replacements, transaction }
      );
    }
    
    // Cập nhật questions nếu có
    if (questions && Array.isArray(questions)) {
      // Validate questions before writing
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q || !q.question_text || !q.type) {
          await transaction.rollback();
          return res.status(400).json({ message: `Invalid question at index ${i}`, status: "error" });
        }
        if (q.type === 'MCQ') {
          const opts = Array.isArray(q.options) ? q.options : [];
          const correctCount = opts.filter(o => !!o.is_correct).length;
          if (opts.length < 2 || correctCount !== 1) {
            await transaction.rollback();
            return res.status(400).json({ message: `MCQ at index ${i} must have >=2 options and exactly one correct`, status: "error" });
          }
        }
      }

      // Xóa tất cả questions cũ
      await sequelize.query(
        "DELETE FROM exam_questions WHERE exam_id = :examId",
        { replacements: { examId: idNum }, transaction }
      );
      
      // Thêm questions mới
      for (let i = 0; i < questions.length; i++) {
        const rawQuestion = questions[i];
        // Chuẩn hóa type để khớp ENUM DB
        const rawType = (rawQuestion.type || '').trim();
        let normalizedType;
        const upper = rawType.toUpperCase();
        if (upper === 'MCQ') normalizedType = 'MCQ';
        else if (upper === 'ESSAY') normalizedType = 'Essay';
        else normalizedType = 'Unknown';

        // Sao chép question với type đã chuẩn hóa
        const question = {
          ...rawQuestion,
          type: normalizedType,
        };

        try {
          console.log(`[updateExam] Inserting question ${i} -> type=${question.type}; textLength=${(question.question_text||'').length}`);
          await sequelize.query(
            `INSERT INTO exam_questions (exam_id, question_text, type, model_answer, points, order_index, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            {
              replacements: [
                idNum,
                question.question_text,
                question.type,
                question.model_answer || null,
                (Number.isFinite(question.points) ? question.points : 1),
                question.order_index || i + 1
              ],
              transaction
            }
          );

          // Luôn lấy LAST_INSERT_ID đảm bảo trong transaction
          const idRows = await sequelize.query(`SELECT LAST_INSERT_ID() AS id`, {
            type: QueryTypes.SELECT,
            transaction
          });
          const questionId = idRows && (idRows[0]?.id || idRows.id);
          if (!questionId) {
            throw new Error(`Cannot determine questionId at index ${i}`);
          }

          // Thêm options cho MCQ
          if (question.type === 'MCQ' && Array.isArray(question.options) && question.options.length > 0) {
            for (let oi = 0; oi < question.options.length; oi++) {
              const option = question.options[oi] || {};
              if (option == null) {
                throw new Error(`Option undefined at qIndex=${i} optIndex=${oi}`);
              }
              await sequelize.query(
                `INSERT INTO exam_options (question_id, option_text, is_correct)
                 VALUES (?, ?, ?)`,
                {
                  replacements: [questionId, option.option_text || '', option.is_correct ? 1 : 0],
                  transaction
                }
              );
            }
          }
        } catch (loopErr) {
          await transaction.rollback();
          console.error(`Error inserting question at index ${i}:`, loopErr);
          return res.status(500).json({
            status: 'error',
            message: 'Server error',
            debug: `question_index=${i}; ${loopErr?.message || loopErr}; question=${JSON.stringify(rawQuestion).slice(0,500)}`,
            sql: loopErr?.parent?.sql,
          });
        }
      }
    }
    
    await transaction.commit();
    res.json({
      status: "success",
      message: "Exam updated successfully"
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating exam:", error);
    res.status(500).json({ 
      message: "Server error", 
      status: "error",
      debug: error?.message || null,
      sql: error?.parent?.sql || undefined
    });
  }
};

// Xóa đề thi
const deleteExam = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const instructorId = req.user.id;
    
    // Kiểm tra quyền sở hữu
    const [exam] = await sequelize.query(
      "SELECT id FROM exams WHERE id = ? AND instructor_id = ?",
      { replacements: [id, instructorId], type: QueryTypes.SELECT, transaction }
    );
    
    if (!exam) {
      await transaction.rollback();
      return res.status(404).json({ 
        message: "Exam not found or you don't have permission", 
        status: "error" 
      });
    }
    
    // Kiểm tra xem có submission nào chưa
    const [submissions] = await sequelize.query(
      "SELECT COUNT(*) as count FROM submissions WHERE exam_id = ?",
      { replacements: [id], type: QueryTypes.SELECT, transaction }
    );
    
    if (submissions.count > 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: "Cannot delete exam with existing submissions", 
        status: "error" 
      });
    }
    
    // Xóa exam (cascade sẽ xóa questions và options)
    await sequelize.query(
      "DELETE FROM exams WHERE id = ?",
      { replacements: [id], transaction }
    );
    
    await transaction.commit();

    // Return updated snapshot
    const [updated] = await sequelize.query(
      `SELECT id, title, duration, status, updated_at FROM exams WHERE id = ?`,
      { replacements: [id], type: QueryTypes.SELECT }
    );

    res.json({
      status: "success",
      message: "Exam updated successfully",
      exam: updated
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error deleting exam:", error);
    res.status(500).json({ message: "Server error", status: "error" });
  }
};

// Lấy thống kê dashboard
const getDashboardStats = async (req, res) => {
  try {
    const instructorId = req.user.id;
    
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT e.id) as total_exams,
        COUNT(DISTINCT CASE WHEN e.status = 'published' THEN e.id END) as published_exams,
        COUNT(DISTINCT CASE WHEN e.status = 'draft' THEN e.id END) as draft_exams,
        COUNT(DISTINCT s.id) as total_submissions,
        COUNT(DISTINCT s.user_id) as unique_students,
        AVG(s.total_score) as avg_score,
        COUNT(DISTINCT CASE WHEN s.status = 'pending' THEN s.id END) as pending_submissions
      FROM exams e
      LEFT JOIN submissions s ON e.id = s.exam_id
      WHERE e.instructor_id = ?
    `;
    
    const [stats] = await sequelize.query(statsQuery, {
      replacements: [instructorId],
      type: QueryTypes.SELECT
    });
    
    // Lấy exams gần đây
    const recentExamsQuery = `
      SELECT 
        e.id,
        e.title,
        e.status,
        e.created_at,
        COUNT(DISTINCT s.id) as submission_count
      FROM exams e
      LEFT JOIN submissions s ON e.id = s.exam_id
      WHERE e.instructor_id = ?
      GROUP BY e.id
      ORDER BY e.created_at DESC
      LIMIT 5
    `;
    
    const recentExams = await sequelize.query(recentExamsQuery, {
      replacements: [instructorId],
      type: QueryTypes.SELECT
    });
    
    res.json({
      status: "success",
      data: {
        stats,
        recentExams
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ message: "Server error", status: "error" });
  }
};

// Generate exam room code
const generateRoomCode = async (req, res) => {
  try {
    const { id } = req.params;
    const instructorId = req.user.id;
    
    // Kiểm tra quyền sở hữu
    const [exam] = await sequelize.query(
      "SELECT id FROM exams WHERE id = ? AND instructor_id = ?",
      { replacements: [id, instructorId], type: QueryTypes.SELECT }
    );
    
    if (!exam) {
      return res.status(404).json({ 
        message: "Exam not found or you don't have permission", 
        status: "error" 
      });
    }
    
    // Generate unique room code
    let roomCode;
    let isUnique = false;
    
    while (!isUnique) {
      roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const [existing] = await sequelize.query(
        "SELECT id FROM exams WHERE exam_room_code = ?",
        { replacements: [roomCode], type: QueryTypes.SELECT }
      );
      
      if (!existing) {
        isUnique = true;
      }
    }
    
    // Update exam with room code
    await sequelize.query(
      "UPDATE exams SET exam_room_code = ?, updated_at = NOW() WHERE id = ?",
      { replacements: [roomCode, id] }
    );
    
    res.json({
      status: "success",
      message: "Room code generated successfully",
      data: { roomCode }
    });
  } catch (error) {
    console.error("Error generating room code:", error);
    res.status(500).json({ message: "Server error", status: "error" });
  }
};

// Import từ Excel (LƯU NGUYÊN FILE THÀNH 1 ĐỀ, không đổ xuống exam_questions)
const importFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Vui lòng chọn file Excel",
        status: "error",
      });
    }

    const instructorId = req.user.id;
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return res.status(400).json({
        message: "File Excel rỗng hoặc không có dữ liệu",
        status: "error",
      });
    }

    // Lấy tiêu đề và thời gian nếu có (mặc định 60 phút)
    const firstRow = data[0] || {};
    const examTitle =
      firstRow["Exam Title"] || firstRow["Tiêu đề đề thi"] || "Đề thi từ Excel";
    const examDuration = parseInt(
      firstRow["Duration"] || firstRow["Thời gian"] || 60
    );

    const transaction = await sequelize.transaction();

    try {
      // 1) Tạo exam (chỉ metadata)
      const examRes = await sequelize.query(
        `INSERT INTO exams (title, instructor_id, duration, status, created_at, updated_at)
         VALUES (?, ?, ?, 'draft', NOW(), NOW())`,
        {
          replacements: [examTitle.trim(), instructorId, examDuration || 60],
          type: QueryTypes.INSERT,
          transaction,
        }
      );
      const examId = examRes?.[0] || examRes?.[1]?.insertId;

      // 2) Lưu nguyên JSON của file vào import_jobs + import_rows
      const jobUUID = `job_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      const jobRes = await sequelize.query(
        `INSERT INTO import_jobs (job_uuid, exam_id, created_by, status, preview_json, result_summary, created_at, updated_at)
         VALUES (?, ?, ?, 'completed', ?, ?, NOW(), NOW())`,
        {
          replacements: [
            jobUUID,
            examId,
            instructorId,
            JSON.stringify(data),
            JSON.stringify({ total_rows: data.length, title: examTitle }),
          ],
          type: QueryTypes.INSERT,
          transaction,
        }
      );

      let jobId = jobRes?.[0] || jobRes?.[1]?.insertId;
      if (!jobId) {
        const row = await sequelize.query(`SELECT LAST_INSERT_ID() AS id`, {
          type: QueryTypes.SELECT,
          transaction,
        });
        jobId = row?.[0]?.id || row?.id;
      }

      for (let i = 0; i < data.length; i++) {
        await sequelize.query(
          `INSERT INTO import_rows (job_id, \`row_number\`, row_data, errors, created_at)
           VALUES (?, ?, ?, NULL, NOW())`,
          {
            replacements: [jobId, i + 1, JSON.stringify(data[i])],
            transaction,
          }
        );
      }

      await transaction.commit();

      return res.json({
        message: `✅ Đã lưu 1 đề (file) vào kho, chứa ${data.length} dòng dữ liệu`,
        status: "success",
        data: { examId, jobId, rows: data.length, title: examTitle },
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Import Excel error:", error);
    res.status(500).json({
      message: error.message || "Lỗi khi import file Excel",
      status: "error",
    });
  }
};

// Tạo exam từ dữ liệu đã phân tích (LƯU THÀNH 1 FILE/ĐỀ trong import_jobs, KHÔNG đổ câu)
const createExamFromExcel = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const instructorId = req.user.id;
    const {
      title,
      description,
      duration_minutes = 90,
      start_time,
      end_time,
      preview,
      summary,
    } = req.body;

    if (!title || title.trim().length === 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "Title is required", status: "error" });
    }
    if (!preview || !Array.isArray(preview) || preview.length === 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "No questions to import", status: "error" });
    }

    if (start_time && !isValidDateTime(start_time)) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Invalid start_time format. Use ISO 8601 format",
        status: "error",
      });
    }
    if (end_time && !isValidDateTime(end_time)) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Invalid end_time format. Use ISO 8601 format",
        status: "error",
      });
    }

    // 1) Tạo exam (metadata) - theo schema v5 chỉ lưu title, instructor_id, duration, status
    const [_, metadata] = await sequelize.query(
      `INSERT INTO exams (title, instructor_id, duration, status, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', NOW(), NOW())`,
      {
        replacements: [
          title.trim(),
          instructorId,
          duration_minutes,
        ],
        transaction,
      }
    );
    const examId = metadata.insertId;
    if (!examId) throw new Error("Không thể tạo bản ghi exam mới");

    // 2) Lưu toàn bộ preview vào import_jobs + import_rows
    const jobUUID = `job_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const jobRes = await sequelize.query(
      `INSERT INTO import_jobs (job_uuid, exam_id, created_by, status, preview_json, result_summary, created_at, updated_at)
       VALUES (?, ?, ?, 'completed', ?, ?, NOW(), NOW())`,
      {
        replacements: [
          jobUUID,
          examId,
          instructorId,
          JSON.stringify(preview),
          JSON.stringify(summary || { total: preview.length }),
        ],
        type: QueryTypes.INSERT,
        transaction,
      }
    );
    let jobId = jobRes?.[0] || jobRes?.[1]?.insertId;
    if (!jobId) {
      const row = await sequelize.query(`SELECT LAST_INSERT_ID() AS id`, {
        type: QueryTypes.SELECT,
        transaction,
      });
      jobId = row?.[0]?.id || row?.id;
    }

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

    await transaction.commit();
    return res.status(201).json({
      status: "success",
      message: `✅ Đã lưu 1 đề (file) vào kho, chứa ${preview.length} câu` ,
      data: { examId, jobId, rows: preview.length },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating exam from Excel:", error);
    res
      .status(500)
      .json({ message: "Server error: " + error.message, status: "error" });
  }
};

// Cấu hình multer cho upload file
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file Excel (.xlsx, .xls)'), false);
    }
  }
});

module.exports = {
  getExams,
  getExamDetails,
  createExam,
  createExamFromExcel,
  updateExam,
  deleteExam,
  getDashboardStats,
  generateRoomCode,
  importFromExcel,
  upload
};