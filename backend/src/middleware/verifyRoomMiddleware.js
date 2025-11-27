const sequelize = require("../config/db");
const requireRoomVerification = async (req, res, next) => {
  try {
    // Chỉ áp dụng cho student
    if (req.user.role !== 'student') {
      return next();
    }

    const userId = req.user.id;
    
    // Lấy exam_id từ params hoặc body
    let examId = null;
    if (req.params.id) {
      examId = req.params.id;
    }
    if (req.params.id && req.path.includes('/submissions/')) {
      const submissionId = req.params.id;
      const [subRows] = await sequelize.query(
        `SELECT exam_id FROM submissions WHERE id = ? LIMIT 1`,
        { replacements: [submissionId] }
      );
      if (Array.isArray(subRows) && subRows.length > 0) {
        examId = subRows[0].exam_id;
      }
    }
    if (req.body && req.body.room_token) {
      return next();
    }

    if (!examId) {
      return res.status(400).json({ 
        message: "Không xác định được exam",
        needVerifyRoom: true 
      });
    }

    // Lấy exam_room_code từ exam
    const [examRows] = await sequelize.query(
      `SELECT exam_room_code FROM exams WHERE id = ? LIMIT 1`,
      { replacements: [examId] }
    );
    
    if (!Array.isArray(examRows) || examRows.length === 0) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const roomCode = examRows[0].exam_room_code;

    // Kiểm tra xem student đã verify room chưa
    const [verifiedRows] = await sequelize.query(
      `SELECT id FROM user_verified_rooms 
       WHERE user_id = ? AND exam_room_code = ? 
       LIMIT 1`,
      { replacements: [userId, roomCode] }
    );

    console.log("🔍 [verifyRoomMiddleware] Check verification:", {
      userId,
      examId,
      roomCode,
      verifiedCount: Array.isArray(verifiedRows) ? verifiedRows.length : 0,
      verifiedRows: verifiedRows
    });

    if (!Array.isArray(verifiedRows) || verifiedRows.length === 0) {
      // Chưa verify room
      console.warn("❌ [verifyRoomMiddleware] Student chưa verify room, trả 403");
      return res.status(403).json({ 
        message: "Bạn cần nhập mã phòng thi trước khi truy cập",
        needVerifyRoom: true,
        roomCode: roomCode 
      });
    }

    console.log("✅ [verifyRoomMiddleware] Student đã verify room, cho phép tiếp tục");
    // Đã verify room, cho phép tiếp tục
    next();
  } catch (err) {
    console.error("requireRoomVerification error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { requireRoomVerification };
