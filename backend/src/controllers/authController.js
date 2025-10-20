const bcrypt = require("bcrypt");
const User = require("../models/User");
const ExamRoom = require("../models/ExamRoom");
const { generateAccessToken, generateRefreshToken } = require("../utils/generateToken");

const SALT_ROUNDS = 10;

// ------------------- Đăng ký -------------------
async function register(req, res) {
  try {
    const { fullName, email, password_hash, confirmPassword, role, roomCode } = req.body;

    // ✅ Kiểm tra dữ liệu đầu vào
    if (!fullName || !email || !password_hash || !confirmPassword || !role) {
      return res.status(400).json({ message: "Thiếu trường bắt buộc" });
    }

    if (password_hash.length < 8) {
      return res.status(400).json({ message: "Mật khẩu phải ≥ 8 ký tự" });
    }

    if (password_hash !== confirmPassword) {
      return res.status(400).json({ message: "Mật khẩu và xác nhận không khớp" });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: "Email đã được đăng ký" });
    }

    const hashed = await bcrypt.hash(password_hash, SALT_ROUNDS);
    let newUser;

    if (role === "instructor") {
      newUser = await User.create({
        full_name: fullName,
        email,
        password_hash: hashed,
        role: "instructor",
      });
    } else if (role === "student") {
      if (!roomCode) {
        return res.status(400).json({ message: "Cần mã phòng thi để đăng ký học viên" });
      }

      const room = await ExamRoom.findOne({ where: { exam_room_code: roomCode } });
      if (!room) {
        return res.status(400).json({ message: "Mã phòng thi không hợp lệ" });
      }

      newUser = await User.create({
        full_name: fullName,
        email,
        password_hash: hashed,
        role: "student",
      });

      // 🔧 Tùy logic của bạn: nếu cần liên kết học viên vào phòng thi
      // await room.addStudent(newUser);
    } else {
      return res.status(400).json({ message: "Role không hợp lệ" });
    }

    // ✅ payload đồng bộ với middleware verifyToken
    const payload = {
      id: newUser.id, // ⚠️ dùng id chứ không phải userId
      email: newUser.email,
      role: newUser.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return res.status(201).json({
      user: {
        id: newUser.id,
        fullName: newUser.full_name,
        email: newUser.email,
        role: newUser.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Register error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
}

// ------------------- Đăng nhập -------------------
async function login(req, res) {
  try {
    const { email, password_hash } = req.body;
    if (!email || !password_hash) {
      return res.status(400).json({ message: "Thiếu email hoặc mật khẩu" });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    }

    const match = await bcrypt.compare(password_hash, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    }

    const payload = {
      id: user.id, // ✅ đồng bộ với verifyToken
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return res.status(200).json({
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
}

module.exports = { register, login };
