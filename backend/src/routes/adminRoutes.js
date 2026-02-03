const express = require('express');
const { Op } = require('sequelize');
const { verifyToken } = require('../middleware/authMiddleware');
const { verifyRole } = require('../middleware/verifyRole');
const { activityLoggerMiddleware, logActivity, sanitizeForLog } = require('../middleware/activityLogger');
const { User } = require('../models/User');
const ExamRoom = require('../models/ExamRoom');
const { pool } = require('../config/db');

// Admin models
const {
  AdminActivityLog,
  SuspiciousActivity,
  AdminSettings,
  UserPreferences
} = require('../models/adminModels');

// Services
const backupService = require('../services/backupService');

const router = express.Router();

// Apply activity logger middleware to all admin routes
router.use(activityLoggerMiddleware);

// ============================================================================
// DASHBOARD APIs
// ============================================================================

/**
 * GET /api/admin/dashboard
 * Lấy thống kê tổng quan cho Dashboard
 */
router.get('/dashboard', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    console.log('🔍 [Admin Dashboard] Fetching statistics...');

    // Lấy thống kê từ database
    const totalStudents = await User.count({ where: { role: 'student' } });
    const totalInstructors = await User.count({ where: { role: 'instructor' } });
    const totalAdmins = await User.count({ where: { role: 'admin' } });
    const totalExams = await ExamRoom.count();

    // Tính growth rate
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const studentsThisMonth = await User.count({
      where: { role: 'student', created_at: { [Op.gte]: startOfMonth } }
    });
    const studentsLastMonth = await User.count({
      where: {
        role: 'student',
        created_at: { [Op.between]: [startOfLastMonth, endOfLastMonth] }
      }
    });

    const studentGrowth = studentsLastMonth > 0
      ? Math.round((studentsThisMonth - studentsLastMonth) / studentsLastMonth * 100)
      : studentsThisMonth > 0 ? 100 : 0;

    // User growth by month (last 12 months)
    const userGrowth = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const usersThisMonth = await User.count({
        where: {
          created_at: { [Op.between]: [monthStart, monthEnd] }
        }
      });

      userGrowth.push({
        month: monthNames[date.getMonth()],
        users: usersThisMonth,
        value: usersThisMonth
      });
    }

    // Recent users (last 5)
    const recentUsersData = await User.findAll({
      order: [['created_at', 'DESC']],
      limit: 5,
      attributes: ['id', 'full_name', 'email', 'role', 'created_at']
    });

    const publishedRooms = await ExamRoom.count({ where: { status: 'published' } });

    const recentUsers = recentUsersData.map(user => ({
      id: user.id,
      name: user.full_name || user.email.split('@')[0],
      email: user.email,
      role: user.role,
      initial: (user.full_name || user.email).charAt(0).toUpperCase(),
      color: 'bg-blue-600',
      createdAt: user.created_at
    }));

    // Performance data - average scores per exam
    const [performanceData] = await pool.query(`
      SELECT e.title as exam, ROUND(AVG(s.total_score), 1) as score
      FROM submissions s
      JOIN exams e ON s.exam_id = e.id
      WHERE s.status IN ('graded', 'confirmed')
      GROUP BY e.id
      ORDER BY e.created_at DESC
      LIMIT 5
    `);

    res.json({
      message: 'Dashboard data retrieved successfully',
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      },
      stats: {
        totalStudents,
        totalInstructors,
        totalAdmins,
        totalExamsUploaded: totalExams,
        totalExams,
        publishedRooms,
        studentGrowth,
        instructorGrowth: 5,
        examGrowth: 10
      },
      userGrowth,
      recentUsers,
      performanceData: performanceData.length > 0 ? performanceData : [
        { exam: 'No data', score: 0 }
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Admin dashboard error:', error);
    res.status(500).json({
      message: 'Lỗi server khi truy cập dashboard',
      status: 'error'
    });
  }
});

/**
 * GET /api/admin/upcoming-exams
 * Lấy danh sách bài thi sắp/đang diễn ra
 */
router.get('/upcoming-exams', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const [exams] = await pool.query(`
      SELECT 
        e.id,
        e.title,
        e.status,
        e.time_open,
        e.time_close,
        e.duration_minutes,
        u.full_name as instructor_name,
        (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) as total_questions,
        CASE 
          WHEN NOW() BETWEEN e.time_open AND e.time_close THEN 'active'
          WHEN e.time_open > NOW() THEN 'upcoming'
          ELSE 'ended'
        END as exam_state
      FROM exams e
      LEFT JOIN users u ON e.instructor_id = u.id
      WHERE e.status = 'published' 
        AND (e.time_close > NOW() OR e.time_close IS NULL)
      ORDER BY 
        CASE WHEN NOW() BETWEEN e.time_open AND e.time_close THEN 0 ELSE 1 END,
        e.time_open ASC
      LIMIT 10
    `);

    res.json({ success: true, exams });
  } catch (error) {
    console.error('❌ Error fetching upcoming exams:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// USER MANAGEMENT APIs
// ============================================================================

/**
 * GET /api/admin/users
 * Lấy danh sách tất cả users
 */
router.get('/users', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (role && role !== 'all') {
      where.role = role;
    }
    if (search) {
      where[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: { exclude: ['password_hash'] }
    });

    res.json({
      success: true,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      users: rows
    });
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/users/:id
 * Lấy chi tiết một user
 */
router.get('/users/:id', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User không tồn tại' });
    }

    // Log view action
    await req.logActivity({
      actionType: 'view',
      targetTable: 'users',
      targetId: user.id,
      description: `Xem chi tiết user: ${user.email}`
    });

    res.json({ success: true, user });
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/admin/users/:id
 * Cập nhật thông tin user
 */
router.put('/users/:id', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User không tồn tại' });
    }

    const { full_name, email, role, phone_number, address, gender } = req.body;

    // Không cho phép thay đổi role của admin
    if (user.role === 'admin' && role && role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Không thể thay đổi role của Admin'
      });
    }

    // Chỉ cho phép thay đổi giữa student và instructor
    if (role && role !== user.role) {
      if (user.role === 'admin' || role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Không thể thay đổi role Admin'
        });
      }
    }

    const oldValue = sanitizeForLog(user.toJSON());

    // Cập nhật user - chỉ update fields được gửi (cho phép update từng field riêng lẻ)
    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined && user.role !== 'admin') updateData.role = role;
    if (phone_number !== undefined) updateData.phone_number = phone_number;
    if (address !== undefined) updateData.address = address;
    if (gender !== undefined) updateData.gender = gender;

    await user.update(updateData);

    // Log activity
    await req.logActivity({
      actionType: 'update',
      targetTable: 'users',
      targetId: user.id,
      oldValue,
      newValue: sanitizeForLog(user.toJSON()),
      description: `Cập nhật user: ${user.email}`
    });

    res.json({
      success: true,
      message: 'Cập nhật user thành công',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('❌ Error updating user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Xóa user (soft delete hoặc hard delete)
 */
router.delete('/users/:id', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User không tồn tại' });
    }

    // Không cho phép xóa admin
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Không thể xóa tài khoản Admin'
      });
    }

    const oldValue = sanitizeForLog(user.toJSON());

    // Xóa user
    await user.destroy();

    // Log activity
    await req.logActivity({
      actionType: 'delete',
      targetTable: 'users',
      targetId: parseInt(req.params.id),
      oldValue,
      description: `Xóa user: ${oldValue.email}`
    });

    res.json({ success: true, message: 'Xóa user thành công' });
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// EXAM MANAGEMENT APIs
// ============================================================================

/**
 * GET /api/admin/exams
 * Lấy danh sách tất cả bài thi
 */
router.get('/exams', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (status && status !== 'all') {
      whereClause += ' AND e.status = ?';
      params.push(status);
    }
    if (search) {
      whereClause += ' AND (e.title LIKE ? OR u.full_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [exams] = await pool.query(`
      SELECT 
        e.*,
        u.full_name as instructor_name,
        u.email as instructor_email,
        (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) as total_questions,
        (SELECT COUNT(DISTINCT s.user_id) FROM submissions s WHERE s.exam_id = e.id) as total_submissions,
        CASE 
          WHEN e.time_open IS NOT NULL AND e.time_close IS NOT NULL 
               AND NOW() BETWEEN e.time_open AND e.time_close 
          THEN 0 ELSE 1 
        END as can_delete
      FROM exams e
      LEFT JOIN users u ON e.instructor_id = u.id
      WHERE ${whereClause}
      ORDER BY 
        CASE 
          WHEN e.time_open IS NOT NULL AND e.time_close IS NOT NULL 
               AND NOW() BETWEEN e.time_open AND e.time_close THEN 0
          WHEN e.time_open IS NOT NULL AND e.time_open > NOW() THEN 1
          WHEN e.time_close IS NOT NULL AND e.time_close < NOW() THEN 3
          ELSE 2
        END,
        e.time_open ASC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const [[{ total }]] = await pool.query(`
      SELECT COUNT(*) as total FROM exams e 
      LEFT JOIN users u ON e.instructor_id = u.id 
      WHERE ${whereClause}
    `, params);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      exams
    });
  } catch (error) {
    console.error('❌ Error fetching exams:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/exams/:id
 * Lấy chi tiết một bài thi
 */
router.get('/exams/:id', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const [exams] = await pool.query(`
      SELECT e.*, u.full_name as instructor_name
      FROM exams e
      LEFT JOIN users u ON e.instructor_id = u.id
      WHERE e.id = ?
    `, [req.params.id]);

    if (exams.length === 0) {
      return res.status(404).json({ success: false, message: 'Bài thi không tồn tại' });
    }

    const [questions] = await pool.query(`
      SELECT eq.*, 
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', eo.id, 'text', eo.option_text, 'is_correct', eo.is_correct))
         FROM exam_options eo WHERE eo.question_id = eq.id) as options
      FROM exam_questions eq
      WHERE eq.exam_id = ?
      ORDER BY eq.order_index
    `, [req.params.id]);

    res.json({
      success: true,
      exam: exams[0],
      questions
    });
  } catch (error) {
    console.error('❌ Error fetching exam:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/admin/exams/:id/time
 * Cập nhật thời gian kết thúc bài thi
 */
router.put('/exams/:id/time', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { time_close } = req.body;

    const [exams] = await pool.query('SELECT * FROM exams WHERE id = ?', [req.params.id]);

    if (exams.length === 0) {
      return res.status(404).json({ success: false, message: 'Bài thi không tồn tại' });
    }

    const exam = exams[0];
    const oldValue = { time_close: exam.time_close };

    // Kiểm tra time_close phải sau hiện tại
    if (new Date(time_close) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian kết thúc phải sau thời điểm hiện tại'
      });
    }

    await pool.query('UPDATE exams SET time_close = ? WHERE id = ?', [time_close, req.params.id]);

    // Log activity
    await req.logActivity({
      actionType: 'update',
      targetTable: 'exams',
      targetId: parseInt(req.params.id),
      oldValue,
      newValue: { time_close },
      description: `Cập nhật thời gian kết thúc bài thi: ${exam.title}`
    });

    res.json({ success: true, message: 'Cập nhật thời gian thành công' });
  } catch (error) {
    console.error('❌ Error updating exam time:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/admin/exams/:id
 * Xóa bài thi (chỉ khi không đang trong thời gian thi)
 */
router.delete('/exams/:id', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const [exams] = await pool.query('SELECT * FROM exams WHERE id = ?', [req.params.id]);

    if (exams.length === 0) {
      return res.status(404).json({ success: false, message: 'Bài thi không tồn tại' });
    }

    const exam = exams[0];

    // Kiểm tra bài thi có đang trong thời gian thi không
    const now = new Date();
    if (exam.time_open && exam.time_close) {
      const timeOpen = new Date(exam.time_open);
      const timeClose = new Date(exam.time_close);

      if (now >= timeOpen && now <= timeClose) {
        return res.status(403).json({
          success: false,
          message: 'Không thể xóa bài thi đang trong thời gian thi. Vui lòng đợi đến khi bài thi kết thúc.'
        });
      }
    }

    const oldValue = exam;

    // Xóa bài thi (CASCADE sẽ xóa questions, options, submissions, etc.)
    await pool.query('DELETE FROM exams WHERE id = ?', [req.params.id]);

    // Log activity
    await req.logActivity({
      actionType: 'delete',
      targetTable: 'exams',
      targetId: parseInt(req.params.id),
      oldValue,
      description: `Xóa bài thi: ${exam.title}`
    });

    res.json({ success: true, message: 'Xóa bài thi thành công' });
  } catch (error) {
    console.error('❌ Error deleting exam:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// RESULTS APIs
// ============================================================================

/**
 * GET /api/admin/results
 * Lấy tổng hợp kết quả thi
 */
router.get('/results', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { exam_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = '1=1';
    const params = [];

    if (exam_id) {
      whereClause += ' AND s.exam_id = ?';
      params.push(exam_id);
    }

    const [results] = await pool.query(`
      SELECT 
        s.id as submission_id,
        s.exam_id,
        e.title as exam_title,
        s.user_id as student_id,
        u.full_name as student_name,
        u.email as student_email,
        s.total_score,
        s.ai_score,
        s.suggested_total_score,
        s.status,
        s.instructor_confirmed,
        s.submitted_at,
        s.cheating_count
      FROM submissions s
      JOIN exams e ON s.exam_id = e.id
      JOIN users u ON s.user_id = u.id
      WHERE ${whereClause}
      ORDER BY s.submitted_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const [[{ total }]] = await pool.query(`
      SELECT COUNT(*) as total FROM submissions s WHERE ${whereClause}
    `, params);

    // Lấy danh sách exams để filter
    const [exams] = await pool.query(`
      SELECT id, title, status FROM exams ORDER BY updated_at DESC
    `);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      results,
      exams
    });
  } catch (error) {
    console.error('❌ Error fetching results:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/admin/results/:submissionId
 * Cập nhật điểm của submission (Admin can edit MCQ, Essay, and Total scores)
 */
router.put('/results/:submissionId', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { mcq_score, essay_score, total_score } = req.body;

    const [submissions] = await pool.query(
      'SELECT s.*, u.email, e.title FROM submissions s JOIN users u ON s.user_id = u.id JOIN exams e ON s.exam_id = e.id WHERE s.id = ?',
      [req.params.submissionId]
    );

    if (submissions.length === 0) {
      return res.status(404).json({ success: false, message: 'Submission không tồn tại' });
    }

    const submission = submissions[0];
    const oldValue = {
      total_score: submission.total_score,
      ai_score: submission.ai_score,
      suggested_total_score: submission.suggested_total_score
    };

    // Determine new values (use provided values or keep existing)
    const newMcqScore = mcq_score !== undefined ? parseFloat(mcq_score) : submission.total_score;
    const newEssayScore = essay_score !== undefined ? parseFloat(essay_score) : submission.ai_score;
    const newTotalScore = total_score !== undefined ? parseFloat(total_score) : (newMcqScore + (newEssayScore || 0));

    // Update submissions table with all score fields
    await pool.query(
      `UPDATE submissions 
       SET total_score = ?, 
           ai_score = ?, 
           suggested_total_score = ?, 
           instructor_confirmed = 1, 
           status = 'confirmed' 
       WHERE id = ?`,
      [newMcqScore, newEssayScore, newTotalScore, req.params.submissionId]
    );

    // Also update results table to sync
    await pool.query(
      `UPDATE results 
       SET total_score = ?, status = 'confirmed' 
       WHERE exam_id = ? AND student_id = ?`,
      [newTotalScore, submission.exam_id, submission.user_id]
    );

    const newValue = {
      total_score: newMcqScore,
      ai_score: newEssayScore,
      suggested_total_score: newTotalScore
    };

    // Log activity with detailed description for instructor visibility
    await req.logActivity({
      actionType: 'admin_score_edit',
      targetTable: 'submissions',
      targetId: parseInt(req.params.submissionId),
      oldValue,
      newValue,
      description: `[ADMIN SỬA ĐIỂM] ${submission.email} - ${submission.title}: MCQ(${oldValue.total_score ?? 'N/A'}→${newMcqScore}), Essay(${oldValue.ai_score ?? 'N/A'}→${newEssayScore}), Tổng(${oldValue.suggested_total_score ?? 'N/A'}→${newTotalScore})`
    });

    res.json({
      success: true,
      message: 'Cập nhật điểm thành công',
      data: {
        mcq_score: newMcqScore,
        essay_score: newEssayScore,
        total_score: newTotalScore
      }
    });
  } catch (error) {
    console.error('❌ Error updating result:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/admin/results/:submissionId
 * Xóa kết quả của một submission
 */
router.delete('/results/:submissionId', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const [submissions] = await pool.query(
      'SELECT s.*, u.email, e.title FROM submissions s JOIN users u ON s.user_id = u.id JOIN exams e ON s.exam_id = e.id WHERE s.id = ?',
      [req.params.submissionId]
    );

    if (submissions.length === 0) {
      return res.status(404).json({ success: false, message: 'Submission không tồn tại' });
    }

    const submission = submissions[0];

    await pool.query('DELETE FROM submissions WHERE id = ?', [req.params.submissionId]);

    // Log activity
    await req.logActivity({
      actionType: 'delete',
      targetTable: 'submissions',
      targetId: parseInt(req.params.submissionId),
      oldValue: submission,
      description: `Xóa kết quả thi: ${submission.email} - ${submission.title}`
    });

    res.json({ success: true, message: 'Xóa kết quả thành công' });
  } catch (error) {
    console.error('❌ Error deleting result:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// BACKUP & RESTORE APIs
// ============================================================================

/**
 * POST /api/admin/backup
 * Tạo backup database
 */
router.post('/backup', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    console.log('📦 [Admin] Starting manual backup...');

    const result = await backupService.createBackup({
      backupType: 'manual',
      performedBy: req.user.id,
      performedByEmail: req.user.email
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Backup thành công',
        backup: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Backup thất bại: ' + result.error
      });
    }
  } catch (error) {
    console.error('❌ Error creating backup:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/backup/history
 * Lấy lịch sử backup
 */
router.get('/backup/history', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await backupService.getBackupList({
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      ...result,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(result.total / limit)
    });
  } catch (error) {
    console.error('❌ Error fetching backup history:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/restore
 * Restore database từ backup
 */
router.post('/restore', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { backup_id } = req.body;

    if (!backup_id) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn backup để restore' });
    }

    console.log(`🔄 [Admin] Starting restore from backup ID: ${backup_id}...`);

    const result = await backupService.restoreBackup({
      backupId: backup_id,
      performedBy: req.user.id,
      performedByEmail: req.user.email
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Restore thành công',
        restore: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Restore thất bại: ' + result.error
      });
    }
  } catch (error) {
    console.error('❌ Error restoring backup:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// SYSTEM LOGS APIs
// ============================================================================

/**
 * GET /api/admin/logs
 * Lấy system logs
 */
router.get('/logs', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, action_type, search, date_from, date_to } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    if (action_type && action_type !== 'all') {
      where.action_type = action_type;
    }
    if (search) {
      where[Op.or] = [
        { admin_email: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    if (date_from) {
      where.created_at = { ...where.created_at, [Op.gte]: new Date(date_from) };
    }
    if (date_to) {
      where.created_at = { ...where.created_at, [Op.lte]: new Date(date_to) };
    }

    const { count, rows } = await AdminActivityLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      logs: rows
    });
  } catch (error) {
    console.error('❌ Error fetching logs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/logs/suspicious
 * Lấy danh sách hoạt động đáng ngờ
 */
router.get('/logs/suspicious', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, is_reviewed } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (is_reviewed !== undefined) {
      where.is_reviewed = is_reviewed === 'true';
    }

    const { count, rows } = await SuspiciousActivity.findAndCountAll({
      where,
      order: [['detected_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      activities: rows
    });
  } catch (error) {
    console.error('❌ Error fetching suspicious activities:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/admin/logs/suspicious/:id/review
 * Đánh dấu đã xem xét hoạt động đáng ngờ
 */
router.put('/logs/suspicious/:id/review', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { action_taken } = req.body;

    const activity = await SuspiciousActivity.findByPk(req.params.id);
    if (!activity) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hoạt động' });
    }

    await activity.update({
      is_reviewed: true,
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
      action_taken: action_taken || 'Đã xem xét'
    });

    res.json({ success: true, message: 'Đã đánh dấu xem xét' });
  } catch (error) {
    console.error('❌ Error reviewing suspicious activity:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// SETTINGS APIs
// ============================================================================

/**
 * GET /api/admin/settings
 * Lấy cài đặt admin
 */
router.get('/settings', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const settings = await AdminSettings.findAll();

    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.setting_key] = s.setting_value;
    });

    res.json({ success: true, settings: settingsMap });
  } catch (error) {
    console.error('❌ Error fetching settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/admin/settings
 * Cập nhật cài đặt admin
 */
router.put('/settings', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { settings } = req.body;

    for (const [key, value] of Object.entries(settings)) {
      await AdminSettings.setSetting(key, value, req.user.id);

      // Cập nhật backup scheduler nếu backup_schedule thay đổi
      if (key === 'backup_schedule' && value) {
        try {
          const { updateSchedule } = require('../services/backupScheduler');
          updateSchedule(value);
        } catch (err) {
          console.warn('⚠️ Could not update backup scheduler:', err.message);
        }
      }
    }

    // Log activity
    await req.logActivity({
      actionType: 'update',
      targetTable: 'admin_settings',
      newValue: settings,
      description: `Cập nhật cài đặt admin`
    });

    res.json({ success: true, message: 'Cập nhật cài đặt thành công' });
  } catch (error) {
    console.error('❌ Error updating settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// THEME & PREFERENCES APIs
// ============================================================================

/**
 * GET /api/admin/preferences
 * Lấy preferences của user hiện tại
 */
router.get('/preferences', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const prefs = await UserPreferences.getPreferences(req.user.id);
    res.json({ success: true, preferences: prefs });
  } catch (error) {
    console.error('❌ Error fetching preferences:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/admin/preferences
 * Cập nhật preferences (theme, language, etc.)
 */
router.put('/preferences', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { theme, language, notifications } = req.body;

    const updates = {};
    if (theme) updates.theme = theme;
    if (language) updates.language = language;
    if (notifications) updates.notifications = notifications;

    await UserPreferences.updatePreferences(req.user.id, updates);

    res.json({ success: true, message: 'Cập nhật preferences thành công' });
  } catch (error) {
    console.error('❌ Error updating preferences:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/profile
 * Lấy thông tin profile của admin hiện tại
 */
router.get('/profile', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] }
    });

    const preferences = await UserPreferences.getPreferences(req.user.id);

    res.json({
      success: true,
      user: user.toJSON(),
      preferences,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy profile'
    });
  }
});

module.exports = router;

