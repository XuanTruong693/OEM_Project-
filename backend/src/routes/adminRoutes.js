const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { verifyRole } = require('../middleware/verifyRole');

const router = express.Router();

/**
 * Admin Dashboard Route
 * GET /api/admin/dashboard
 * Chỉ admin mới có thể truy cập
 */
router.get('/dashboard', verifyToken, verifyRole('admin'), (req, res) => {
  try {
    res.json({
      message: 'Welcome Admin!',
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      },
      dashboard: {
        title: 'Admin Dashboard',
        description: 'Quản lý hệ thống OEM Mini',
        features: [
          'Quản lý người dùng',
          'Quản lý phòng thi',
          'Xem báo cáo thống kê',
          'Cấu hình hệ thống'
        ]
      },
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
