const express = require("express");
const router = express.Router();
const {
  getExams,
  getExamDetails,
  createExam,
  createExamFromExcel,
  updateExam,
  deleteExam,
  getDashboardStats,
  generateRoomCode
} = require("../controllers/examController");
const { verifyToken, authorizeRole } = require("../middleware/authMiddleware");

// Dashboard stats - phải đặt trước các routes có :id
router.get(
  "/dashboard-stats",
  verifyToken,
  authorizeRole(["instructor", "admin"]),
  getDashboardStats
);

// Lấy danh sách đề thi
router.get(
  "/",
  verifyToken,
  authorizeRole(["instructor", "admin"]),
  getExams
);

// Tạo đề thi mới
router.post(
  "/",
  verifyToken,
  authorizeRole(["instructor", "admin"]),
  createExam
);

// Tạo đề thi từ file Excel đã phân tích
router.post(
  "/from-excel",
  verifyToken,
  authorizeRole(["instructor", "admin"]),
  createExamFromExcel
);

// Lấy chi tiết đề thi
router.get(
  "/:id",
  verifyToken,
  authorizeRole(["instructor", "admin"]),
  getExamDetails
);

// Cập nhật đề thi
router.put(
  "/:id",
  verifyToken,
  authorizeRole(["instructor", "admin"]),
  updateExam
);

// Xóa đề thi
router.delete(
  "/:id",
  verifyToken,
  authorizeRole(["instructor", "admin"]),
  deleteExam
);

// Generate room code cho đề thi
router.post(
  "/:id/generate-room-code",
  verifyToken,
  authorizeRole(["instructor", "admin"]),
  generateRoomCode
);

// (Open/Close room routes tạm thời gỡ bỏ do controller chưa sẵn)

module.exports = router;