const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { verifyRole } = require('../middleware/verifyRole');
const { User } = require('../models/User');
const ExamRoom = require('../models/ExamRoom');

const router = express.Router();

/**
 * Admin Dashboard Route
 * GET /api/admin/dashboard
 * Chỉ admin mới có thể truy cập
 */
router.get('/dashboard', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    console.log('🔍 [Admin Dashboard] Fetching statistics...');
    
    // Lấy thống kê từ database
    const totalStudents = await User.count({ where: { role: 'student' } });
    const totalInstructors = await User.count({ where: { role: 'instructor' } });
    const totalAdmins = await User.count({ where: { role: 'admin' } });
    const totalExams = await ExamRoom.count();
    
    console.log('📊 [Admin Dashboard] Statistics:', {
      totalStudents,
      totalInstructors,
      totalAdmins,
      totalExams
    });

    // Calculate user growth by month for the last 12 months
    const userGrowth = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const usersThisMonth = await User.count({
        where: {
          created_at: {
            [require('sequelize').Op.between]: [startOfMonth, endOfMonth]
          }
        }
      });
      
      const monthName = monthNames[date.getMonth()];
      userGrowth.push({
        month: monthName,
        users: usersThisMonth,
        value: usersThisMonth
      });
    }
    
    // Get recent users (last 5 users registered)
    const recentUsersData = await User.findAll({
      order: [['created_at', 'DESC']],
      limit: 5,
      attributes: ['id', 'full_name', 'email']
    });
    
    // Count exam rooms
    const publishedRooms = await ExamRoom.count({ where: { status: 'published' } });
    
    const recentUsers = recentUsersData.map(user => ({
      id: user.id,
      name: user.full_name || user.email.split('@')[0],
      initial: (user.full_name || user.email).charAt(0).toUpperCase(),
      color: 'bg-blue-600'
    }));
    
    // Get performance data (you can customize this based on your actual exam results table)
    const performanceData = [
      { exam: 'Exam 1', score: 65 },
      { exam: 'Exam 7', score: 75 },
      { exam: 'Exam 4', score: 82 },
      { exam: 'Exam 6', score: 88 },
      { exam: 'Final', score: 92 }
    ];

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
        totalExams: totalExams,
        publishedRooms,
        studentGrowth: 18,
        instructorGrowth: 5,
        examGrowth: 10
      },
      userGrowth: userGrowth,
      recentUsers: recentUsers,
      performanceData: performanceData,
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
 * Admin Profile Route
 * GET /api/admin/profile
 * Lấy thông tin profile của admin hiện tại
 */
router.get('/profile', verifyToken, verifyRole('admin'), (req, res) => {
  try {
    res.json({
      message: 'Admin profile retrieved successfully',
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Admin profile error:', error);
    res.status(500).json({
      message: 'Lỗi server khi lấy profile',
      status: 'error'
    });
  }
});

module.exports = router;
