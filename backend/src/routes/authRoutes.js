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
    const { idToken, role } = req.body;

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
    let { full_name, email, password, role } = req.body;

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

// 🔑 Đăng nhập
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
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

// 🏫 Xác minh mã phòng (Verify Room)
router.get("/verify-room/:code", (req, res) => {
  const { code } = req.params;

  // Giả lập: mã phòng "ABC123" là hợp lệ
  if (code === "ABC123") {
    return res.json({ valid: true, roomId: "room_001" });
  } else {
    return res.json({ valid: false, message: "Mã phòng không hợp lệ" });
  }
});

module.exports = router;
