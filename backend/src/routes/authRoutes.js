const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const { User, UserVerifiedRoom } = require("../models/User");
const dns = require("dns").promises;
dotenv.config();

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// JWT generator
const generateToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

// Helper: lấy exam theo roomId hoặc exam_room_code
const getExamByRoom = async (roomId) => {
  const Exam = require("../models/ExamRoom");
  if (!roomId) return null;

  // ✅ Fix: Kiểm tra nếu roomId là số thì lấy theo id, ngược lại lấy theo exam_room_code
  if (/^\d+$/.test(roomId.toString())) {
    return await Exam.findByPk(roomId);
  } else {
    return await Exam.findOne({ where: { exam_room_code: roomId } });
  }
};

// --- Google login / create ---
router.post("/google", async (req, res) => {
  console.log("🟢 [BACKEND] Google login/register API hit!");
  console.log("📩 Payload từ FE:", req.body);

  try {
    const { idToken, role, roomId } = req.body;
    if (!idToken || !role)
      return res
        .status(400)
        .json({ message: "Thiếu idToken hoặc role", status: "error" });
    if (role === "student" && !roomId)
      return res
        .status(400)
        .json({ message: "Học viên cần mã phòng thi", status: "error" });

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email?.toLowerCase().trim();
    const full_name = payload.name;
    console.log(
      "[Google Login] Verified email:",
      email,
      "full_name:",
      full_name
    );
    if (role === "student") console.log("[Google Login] Room ID:", roomId);
    if (!email || !full_name)
      return res
        .status(400)
        .json({ message: "Google token không hợp lệ", status: "error" });

    let user = await User.findOne({ where: { email } });

    if (!user) {
      user = await User.create({
        full_name,
        email,
        password_hash: await bcrypt.hash(Date.now().toString(), 10),
        role,
        created_at: new Date(),
      });

      if (role === "student") {
        const exam = await getExamByRoom(roomId);
        if (!exam)
          return res
            .status(400)
            .json({ message: "Mã phòng thi không hợp lệ", status: "error" });

        // ✅ Fix: đảm bảo lưu đúng exam_room_code
        await UserVerifiedRoom.create({
          user_id: user.id,
          exam_room_code: exam.exam_room_code,
        });
      }
    } else if (role === "student") {
      const exam = await getExamByRoom(roomId);
      if (!exam)
        return res
          .status(400)
          .json({ message: "Mã phòng thi không hợp lệ", status: "error" });

      const verified = await UserVerifiedRoom.findOne({
        where: { user_id: user.id, exam_room_code: exam.exam_room_code },
      });

      // ✅ Fix: kiểm tra nếu chưa có thì thêm mới, tránh lỗi “không khớp tài khoản”
      if (!verified) {
        await UserVerifiedRoom.create({
          user_id: user.id,
          exam_room_code: exam.exam_room_code,
        });
        console.log("[Google Login] ➕ Tự động liên kết user với phòng thi.");
      }
    }

    console.log(`[Google Login] ✅ Đăng nhập thành công cho ${email}`);
    const token = generateToken(user);
    res.json({
      message: "Đăng nhập Google thành công",
      status: "success",
      token,
      user: { id: user.id, full_name: user.full_name, role: user.role },
    });
  } catch (err) {
    console.error("❌ Lỗi Google Login:", err.stack);
    res
      .status(500)
      .json({ message: "Lỗi xác thực Google hoặc server", status: "error" });
  }
});

// --- Register ---
router.post("/register", async (req, res) => {
  try {
    const { full_name, email, password, role, roomId } = req.body;
    console.log("[Register] Payload:", req.body);
    console.log("[Register] Creating user:", full_name, email);
    if (role === "student") console.log("[Register] Verified Room:", roomId);
    if (!full_name || !email || !password || !role)
      return res
        .status(400)
        .json({ message: "Thiếu thông tin đăng ký", status: "error" });

    if (role === "student" && !roomId)
      return res
        .status(400)
        .json({ message: "Học viên cần mã phòng thi", status: "error" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res
        .status(400)
        .json({ message: "Định dạng email không hợp lệ", status: "error" });

    const domain = email.split("@")[1];
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        return res.status(400).json({
          message: "Tên miền email không tồn tại hoặc không thể gửi/nhận mail",
          status: "error",
        });
      }
    } catch (dnsErr) {
      return res.status(400).json({
        message: "Tên miền email không hợp lệ hoặc không thể xác minh",
        status: "error",
      });
    }

    const existingUser = await User.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    if (existingUser)
      return res
        .status(400)
        .json({ message: "Email đã được đăng ký", status: "error" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      full_name,
      email: email.toLowerCase().trim(),
      password_hash: hashedPassword,
      role,
      created_at: new Date(),
    });

    if (role === "student") {
      const exam = await getExamByRoom(roomId);
      if (!exam)
        return res
          .status(400)
          .json({ message: "Mã phòng thi không hợp lệ", status: "error" });
      await UserVerifiedRoom.create({
        user_id: newUser.id,
        exam_room_code: exam.exam_room_code,
      });
    }

    const token = generateToken(newUser);
    res.status(201).json({
      message: "Đăng ký thành công",
      status: "success",
      token,
      user: {
        id: newUser.id,
        full_name: newUser.full_name,
        role: newUser.role,
      },
    });
  } catch (err) {
    console.error("❌ Lỗi đăng ký:", err);
    res.status(500).json({ message: "Lỗi server", status: "error" });
  }
});

// --- Login thường ---
router.post("/login", async (req, res) => {
  try {
    const { email, password, role, roomId } = req.body;
    console.log("[Login] Payload:", req.body);

    if (!email || !password) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ email và mật khẩu",
        status: "error",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ message: "Địa chỉ email không hợp lệ", status: "error" });
    }

    const domain = email.split("@")[1];
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        return res.status(400).json({
          message: "Email này không tồn tại hoặc không thể nhận thư",
          status: "error",
        });
      }
    } catch {
      return res.status(400).json({
        message: "Không thể xác minh tên miền email, vui lòng kiểm tra lại",
        status: "error",
      });
    }

    // kiểm tra trong database
    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy tài khoản", status: "error" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        message: "Mật khẩu không chính xác",
        status: "error",
      });
    }

    if (role === "student") {
      if (!roomId)
        return res
          .status(400)
          .json({ message: "Học viên cần mã phòng thi", status: "error" });

      const exam = await getExamByRoom(roomId);
      if (!exam)
        return res
          .status(400)
          .json({ message: "Mã phòng thi không hợp lệ", status: "error" });
      const verified = await UserVerifiedRoom.findOne({
        where: { user_id: user.id, exam_room_code: exam.exam_room_code },
      });

      // ✅ Fix: nếu học viên chưa từng lưu mã phòng, tự động thêm
      if (!verified) {
        await UserVerifiedRoom.create({
          user_id: user.id,
          exam_room_code: exam.exam_room_code,
        });
        console.log("[Login] ➕ Liên kết user với phòng thi mới.");
      }
    }

    const token = generateToken(user);
    res.json({
      message: "Đăng nhập thành công",
      status: "success",
      token,
      user: { id: user.id, full_name: user.full_name, role: user.role },
    });
  } catch (err) {
    console.error("❌ Lỗi đăng nhập:", err);
    res.status(500).json({ message: "Lỗi server", status: "error" });
  }
});

// --- Verify Room ---
router.get("/verify-room/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const Exam = require("../models/ExamRoom");
    const exam = await Exam.findOne({ where: { exam_room_code: code } });

    if (!exam)
      return res.json({ valid: false, message: "Mã phòng không hợp lệ" });
    if (exam.status !== "published")
      return res.json({
        valid: false,
        message: "Phòng thi chưa được kích hoạt",
      });

    res.json({
      valid: true,
      roomId: exam.exam_room_code, // ✅ Fix: gửi exam_room_code thay vì exam.id
      examCode: code,
      title: exam.title,
    });
  } catch (err) {
    console.error("❌ Lỗi verify room:", err);
    res.status(500).json({ valid: false, message: "Lỗi server" });
  }
});

module.exports = router;
