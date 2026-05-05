const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../models/User");
const ExamRoom = require("../models/ExamRoom");
const { generateAccessToken, generateRefreshToken } = require("../utils/generateToken");
const { addToBlacklist } = require("../utils/tokenBlacklist");

const SALT_ROUNDS = 10;

// Helper to get client IP
const getClientIp = (req) => {
  return req.ip ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    'unknown';
};

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
    } else {
      return res.status(400).json({ message: "Role không hợp lệ" });
    }

    const payload = {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    };

    const clientIp = getClientIp(req);
    const accessToken = generateAccessToken(payload, clientIp);
    const refreshToken = generateRefreshToken(payload);

    await newUser.update({ refresh_token: refreshToken });

    console.log(`✅ [Auth] User registered: ${newUser.email} from IP: ${clientIp}`);

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
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const clientIp = getClientIp(req);
    const accessToken = generateAccessToken(payload, clientIp);
    const refreshToken = generateRefreshToken(payload);

    await user.update({ refresh_token: refreshToken });

    console.log(`✅ [Auth] User logged in: ${user.email} from IP: ${clientIp}`);

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

// ------------------- Refresh Token -------------------
async function refreshTokenHandler(req, res) {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Thiếu refresh token" });
    }

    // Verify refresh token
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    // Check if user still exists
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Người dùng không tồn tại" });
    }

    if (!user.refresh_token || user.refresh_token !== token) {
      return res.status(401).json({ message: "Refresh token đã hết hạn hoặc không hợp lệ" });
    }

    // Generate new access token and rotate refresh token
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const clientIp = getClientIp(req);
    const newAccessToken = generateAccessToken(payload, clientIp);
    const newRefreshToken = generateRefreshToken(payload);

    await user.update({ refresh_token: newRefreshToken });

    console.log(`🔄 [Auth] Token refreshed and rotated for: ${user.email}`);

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: "Refresh token đã hết hạn. Vui lòng đăng nhập lại.",
        refreshExpired: true
      });
    }
    console.error("❌ Refresh token error:", error);
    return res.status(401).json({ message: "Refresh token không hợp lệ" });
  }
}

// ------------------- Logout -------------------
async function logout(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];

      // Decode to get expiry time
      try {
        const decoded = jwt.decode(token);
        const expiresAt = decoded.exp ? decoded.exp * 1000 : Date.now() + 2 * 60 * 60 * 1000;

        // Add to blacklist
        addToBlacklist(token, expiresAt);
        console.log(`🔒 [Auth] User logged out, token blacklisted`);
      } catch (e) {
        // Token invalid, but still proceed with logout
      }
    }

    return res.status(200).json({ message: "Đăng xuất thành công" });
  } catch (error) {
    console.error("❌ Logout error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
}

module.exports = { register, login, refreshToken: refreshTokenHandler, logout };

