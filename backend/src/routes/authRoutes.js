const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const User = require("../models/User");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
dotenv.config();
const router = express.Router();

// 🔐 Hàm tạo token
const generateToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
};
// 🌐 Đăng nhập với Google
router.post("/google", async (req, res) => {
  try {
    const { idToken, role, roomId } = req.body;

    if (!idToken || !role) {
      return res.status(400).json({
        message: "Thiếu thông tin (idToken hoặc role)",
        status: "error",
      });
    }
    console.log("🔍 CLIENT_ID BE:", process.env.GOOGLE_CLIENT_ID);
    console.log("🔍 ID Token (audience):", jwt.decode(idToken)?.aud);

    // ✅ Xác thực token với Google
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const email = payload.email?.toLowerCase().trim();
    const full_name = payload.name;

    // ✅ Kiểm tra role hợp lệ
    const validRoles = ["student", "instructor"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        message: "Vai trò không hợp lệ (phải chọn student hoặc instructor)",
        status: "error",
      });
    }

    // ✅ Kiểm tra student cần roomId
    if (role === "student" && !roomId) {
      return res.status(400).json({
        message: "Học viên cần mã phòng thi để đăng nhập",
        status: "error",
      });
    }

    // ✅ Kiểm tra xem user đã tồn tại chưa
    let user = await User.findOne({ where: { email } });

    if (!user) {
      // ✅ Nếu chưa, tạo mới user
      user = await User.create({
        full_name,
        email,
        password_hash: await bcrypt.hash(Date.now().toString(), 10), // tạm thời sinh mật khẩu ngẫu nhiên
        role,
        created_at: new Date(),
      });

      // ✅ Nếu là student, lưu exam_room_code vào verify_room_code (chỉ khi đăng ký lần đầu)
      if (role === "student" && roomId) {
        console.log("🔍 Setting verify_room_code for new Google student:", {
          roomId,
        });
        // Tìm exam để lấy exam_room_code thực tế - roomId có thể là ID số hoặc exam_room_code
        const Exam = require("../models/ExamRoom");
        let exam;

        // Thử tìm bằng ID trước, nếu không có thì tìm bằng exam_room_code
        if (isNaN(roomId)) {
          exam = await Exam.findOne({ where: { exam_room_code: roomId } });
        } else {
          exam = await Exam.findByPk(roomId);
        }

        if (exam) {
          console.log("📋 Found exam for Google user:", exam.exam_room_code);
          await user.update({ verify_room_code: exam.exam_room_code });
        } else {
          console.log("❌ Exam not found for Google user roomId:", roomId);
          return res.status(400).json({
            message: "Mã phòng thi không hợp lệ",
            status: "error",
          });
        }
      }
    } else {
      // ✅ Kiểm tra roomId có khớp với user không (nếu là student) - chỉ kiểm tra, không cập nhật
      if (role === "student") {
        console.log("🔍 Verifying room code for existing Google student:", {
          roomId,
          userVerifyRoomCode: user.verify_room_code,
        });

        // Tìm exam để lấy exam_room_code - roomId có thể là ID số hoặc exam_room_code
        const Exam = require("../models/ExamRoom");
        let exam;

        // Thử tìm bằng ID trước, nếu không có thì tìm bằng exam_room_code
        if (isNaN(roomId)) {
          exam = await Exam.findOne({ where: { exam_room_code: roomId } });
        } else {
          exam = await Exam.findByPk(roomId);
        }

        if (!exam) {
          console.log("❌ Exam not found for Google user roomId:", roomId);
          return res.status(400).json({
            message: "Mã phòng thi không hợp lệ",
            status: "error",
          });
        }

        if (user.verify_room_code !== exam.exam_room_code) {
          console.log("❌ Google user room code mismatch:", {
            provided: exam.exam_room_code,
            stored: user.verify_room_code,
          });
          return res.status(400).json({
            message: "Mã phòng thi không khớp với tài khoản",
            status: "error",
          });
        }

        console.log("✅ Google user room code verified successfully");
      }
    }

    // ✅ Sinh token JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "Đăng nhập Google thành công",
      status: "success",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("❌ Lỗi Google Login:", err);
    res.status(500).json({
      message: "Lỗi xác thực Google hoặc server",
      status: "error",
    });
  }
});

// 📝 Đăng ký thường
router.post("/register", async (req, res) => {
  try {
    let { full_name, email, password, role, roomId } = req.body;

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({
        message: "Thiếu thông tin đăng ký (full_name, email, password, role)",
        status: "error",
      });
    }

    // Chuẩn hóa email (tránh trùng viết hoa/thường)
    email = email.toLowerCase().trim();

    // ✅ Kiểm tra role hợp lệ
    const validRoles = ["student", "instructor"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        message: "Vai trò không hợp lệ (phải chọn student hoặc instructor)",
        status: "error",
      });
    }

    // ✅ Kiểm tra student cần roomId
    if (role === "student" && !roomId) {
      return res.status(400).json({
        message: "Học viên cần mã phòng thi để đăng ký",
        status: "error",
      });
    }

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Email đã tồn tại", status: "error" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user mới
    const newUser = await User.create({
      full_name,
      email,
      password_hash: hashedPassword,
      role,
      created_at: new Date(),
    });

    // ✅ Nếu là student, lưu exam_room_code vào verify_room_code (chỉ khi đăng ký lần đầu)
    if (role === "student" && roomId) {
      console.log("🔍 Setting verify_room_code for new student:", {
        roomId,
        type: typeof roomId,
      });
      // Tìm exam để lấy exam_room_code thực tế - roomId có thể là ID số hoặc exam_room_code
      const Exam = require("../models/ExamRoom");
      let exam;

      // Thử tìm bằng ID trước, nếu không có thì tìm bằng exam_room_code
      if (isNaN(roomId)) {
        exam = await Exam.findOne({ where: { exam_room_code: roomId } });
      } else {
        exam = await Exam.findByPk(roomId);
      }

      if (exam) {
        console.log("📋 Found exam:", exam.exam_room_code);
        // Cập nhật verify_room_code với exam_room_code thực tế
        await newUser.update({ verify_room_code: exam.exam_room_code });
        console.log("✅ Updated verify_room_code to:", exam.exam_room_code);
      } else {
        console.log("❌ Exam not found for roomId:", roomId);
        return res.status(400).json({
          message: "Mã phòng thi không hợp lệ",
          status: "error",
        });
      }
    }

    // Sinh JWT
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
// 🌐 Đăng nhập với Google (nếu user đã có)
router.post("/google-login", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res
        .status(400)
        .json({ message: "Thiếu idToken", status: "error" });
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email?.toLowerCase().trim();

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        message: "Tài khoản Google chưa được đăng ký",
        status: "error",
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "Đăng nhập Google thành công",
      status: "success",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("❌ Lỗi Google Login:", err);
    res.status(500).json({ message: "Lỗi xác thực Google", status: "error" });
  }
});
// 🔑 Đăng nhập thường
router.post("/login", async (req, res) => {
  try {
    const { email, password, role, roomId } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy tài khoản", status: "error" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Sai mật khẩu", status: "error" });
    }

    // ✅ Kiểm tra student có roomId không
    if (role === "student" && !roomId) {
      return res.status(400).json({
        message: "Học viên cần mã phòng thi để đăng nhập",
        status: "error",
      });
    }

    // ✅ Kiểm tra roomId có khớp với user không (nếu là student) - chỉ kiểm tra, không cập nhật
    if (role === "student") {
      console.log("🔍 Verifying room code for existing student:", {
        roomId,
        userVerifyRoomCode: user.verify_room_code,
      });

      // Tìm exam để lấy exam_room_code - roomId có thể là ID số hoặc exam_room_code
      const Exam = require("../models/ExamRoom");
      let exam;

      // Thử tìm bằng ID trước, nếu không có thì tìm bằng exam_room_code
      if (isNaN(roomId)) {
        exam = await Exam.findOne({ where: { exam_room_code: roomId } });
      } else {
        exam = await Exam.findByPk(roomId);
      }

      if (!exam) {
        console.log("❌ Exam not found for roomId:", roomId);
        return res.status(400).json({
          message: "Mã phòng thi không hợp lệ",
          status: "error",
        });
      }

      if (user.verify_room_code !== exam.exam_room_code) {
        console.log("❌ Room code mismatch:", {
          provided: exam.exam_room_code,
          stored: user.verify_room_code,
        });
        return res.status(400).json({
          message: "Mã phòng thi không khớp với tài khoản",
          status: "error",
        });
      }

      console.log("✅ Room code verified successfully");
    }

    const token = generateToken(user);
    res.json({
      message: "Đăng nhập thành công",
      status: "success",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("❌ Lỗi đăng nhập:", err);
    res.status(500).json({ message: "Lỗi server", status: "error" });
  }
});

// 🏫 Xác minh mã phòng (Verify Room) - Database lookup
router.get("/verify-room/:code", async (req, res) => {
  try {
    const { code } = req.params;
    console.log("🔍 Verifying room code:", code);

    // Tìm exam trong database theo exam_room_code
    const Exam = require("../models/ExamRoom");
    const exam = await Exam.findOne({
      where: { exam_room_code: code },
    });

    console.log(
      "📋 Found exam:",
      exam
        ? {
            id: exam.id,
            exam_room_code: exam.exam_room_code,
            title: exam.title,
            status: exam.status,
          }
        : "Not found"
    );

    if (!exam) {
      console.log("❌ Exam not found for code:", code);
      return res.json({ valid: false, message: "Mã phòng không hợp lệ" });
    }

    // Kiểm tra trạng thái exam
    if (exam.status !== "published") {
      console.log("❌ Exam not published, status:", exam.status);
      return res.json({
        valid: false,
        message: "Phòng thi chưa được kích hoạt",
      });
    }

    console.log("✅ Room verification successful");
    return res.json({
      valid: true,
      roomId: exam.id,
      examCode: code,
      title: exam.title,
    });
  } catch (error) {
    console.error("❌ Lỗi verify room:", error);
    return res.status(500).json({ valid: false, message: "Lỗi server" });
  }
});

module.exports = router;
