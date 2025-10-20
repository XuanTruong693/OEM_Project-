const Exam = require("../models/ExamRoom");
const crypto = require("crypto");

async function createExam(req, res) {
  try {
    // 🔒 Chỉ cho phép giảng viên
    if (req.user.role !== "instructor") {
      return res.status(403).json({ message: "Chỉ giảng viên mới có thể tạo bài thi" });
    }

    const { courseId, title, duration } = req.body;
    if (!courseId || !title || !duration) {
      return res.status(400).json({ message: "Vui lòng cung cấp đủ thông tin: courseId, title, duration" });
    }

    // 🎲 Sinh mã phòng ngẫu nhiên
    const roomCode = crypto.randomBytes(4).toString("hex").toUpperCase();

    // 🧩 Tạo exam room mới
    const newExam = await Exam.create({
      course_id: courseId,
      title: title,
      duration: duration,
      exam_room_code: roomCode,
    });

    return res.status(201).json({
      message: "Tạo bài thi thành công",
      exam: newExam,
    });
  } catch (error) {
    console.error("❌ Create exam error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
}

async function verifyExamCode(req, res) {
  try {
    const { roomCode } = req.body;
    if (!roomCode) {
      return res.status(400).json({ message: "Cần mã phòng thi" });
    }

    const exam = await Exam.findOne({ where: { exam_room_code: roomCode } });
    if (!exam) {
      return res.status(400).json({ message: "Mã phòng thi không hợp lệ" });
    }

    return res.status(200).json({
      valid: true,
      examId: exam.id,
      courseId: exam.course_id,
      title: exam.title,
    });
  } catch (error) {
    console.error("❌ Verify exam code error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
}

module.exports = { createExam, verifyExamCode };
