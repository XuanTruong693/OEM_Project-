const express = require("express");
const router = express.Router();
const { createExam, verifyExamCode } = require("../controllers/examRoomController");
const { verifyToken, authorizeRole } = require("../middleware/authMiddleware");

// ✅ Kiểm tra mã phòng thi (cho sinh viên)
router.post("/verify", verifyExamCode);

// ✅ Tạo phòng thi (chỉ giảng viên)
router.post("/create", verifyToken, authorizeRole("instructor"), createExam);

module.exports = router;
