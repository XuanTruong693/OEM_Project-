import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { users } from "../data/users.js";

const router = express.Router();

// Hàm tạo token
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    "secretkey", // 🔒 bạn có thể cho vào .env sau
    { expiresIn: "1h" }
  );
};

// Đăng ký
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Thiếu email hoặc password", status: "error" });
    }

    const existingUser = users.find((u) => u.email === email);
    if (existingUser) {
      return res.status(400).json({ message: "Email đã tồn tại", status: "error" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: users.length + 1,
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: "student",
      verifiedRoomId: null,
    };

    users.push(newUser);
    const token = generateToken(newUser);

    res.status(201).json({ message: "Đăng ký thành công", status: "success", token, role: newUser.role });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", status: "error" });
  }
});

// Đăng nhập
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = users.find((u) => u.email === email);

    if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản", status: "error" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Sai mật khẩu", status: "error" });

    const token = generateToken(user);
    res.json({ message: "Đăng nhập thành công", status: "success", token, role: user.role });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", status: "error" });
  }
});

// Xác minh mã phòng (Verify Room)
router.get("/verify-room/:code", (req, res) => {
  const { code } = req.params;

  // Giả lập: mã phòng "ABC123" là hợp lệ
  if (code === "ABC123") {
    return res.json({ valid: true, roomId: "room_001" });
  } else {
    return res.json({ valid: false, message: "Mã phòng không hợp lệ" });
  }
});

export default router;
