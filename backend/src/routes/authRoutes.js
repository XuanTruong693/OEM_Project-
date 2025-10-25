const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const { User, UserVerifiedRoom } = require("../models/User");
const dns = require("dns").promises;
const crypto = require("crypto");

let OTPStore = {};
const { sendOTPEmail, testEmailConfig } = require("../services/emailService");
dotenv.config();

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// JWT generator
const generateToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

// OTP storage (in production, use Redis or database)
const otpStorage = new Map();

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Test email configuration on startup (commented out to avoid blocking)
// testEmailConfig();

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

// --- Send OTP for email verification ---
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    console.log("[Send OTP] Email:", email);

    if (!email) {
      return res.status(400).json({
        message: "Email là bắt buộc",
        status: "error",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Định dạng email không hợp lệ",
        status: "error",
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Email đã được đăng ký",
        status: "error",
      });
    }

    // Generate and store OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    otpStorage.set(email.toLowerCase().trim(), {
      otp,
      expiresAt,
      attempts: 0,
    });

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp);

    if (!emailResult.success) {
      console.error(
        `[Send OTP] ❌ Lỗi gửi email đến ${email}:`,
        emailResult.error
      );
      return res.status(500).json({
        message: "Không thể gửi email. Vui lòng thử lại sau.",
        status: "error",
      });
    }

    console.log(`[Send OTP] ✅ OTP đã gửi đến ${email}`);

    res.json({
      message: "Mã OTP đã được gửi đến email của bạn",
      status: "success",
    });
  } catch (err) {
    console.error("❌ Lỗi gửi OTP:", err);
    res.status(500).json({
      message: "Lỗi server khi gửi OTP",
      status: "error",
    });
  }
});

// --- Verify OTP ---
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    console.log("[Verify OTP] Email:", email, "OTP:", otp);

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email và mã OTP là bắt buộc",
        status: "error",
      });
    }

    const emailKey = email.toLowerCase().trim();
    const otpData = otpStorage.get(emailKey);

    if (!otpData) {
      return res.status(400).json({
        message: "Mã OTP không tồn tại hoặc đã hết hạn",
        status: "error",
      });
    }

    // Check if OTP has expired
    if (new Date() > otpData.expiresAt) {
      otpStorage.delete(emailKey);
      return res.status(400).json({
        message: "Mã OTP đã hết hạn",
        status: "error",
      });
    }

    // Check attempts limit
    if (otpData.attempts >= 3) {
      otpStorage.delete(emailKey);
      return res.status(400).json({
        message: "Đã vượt quá số lần thử. Vui lòng gửi lại mã OTP",
        status: "error",
      });
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      otpData.attempts++;
      otpStorage.set(emailKey, otpData);

      return res.status(400).json({
        message: "Mã OTP không chính xác",
        status: "error",
      });
    }

    // OTP is correct - mark email as verified
    otpData.verified = true;
    otpStorage.set(emailKey, otpData);

    console.log(`[Verify OTP] ✅ Email ${email} đã được xác minh`);

    res.json({
      message: "Email đã được xác minh thành công",
      status: "success",
    });
  } catch (err) {
    console.error("❌ Lỗi xác minh OTP:", err);
    res.status(500).json({
      message: "Lỗi server khi xác minh OTP",
      status: "error",
    });
  }
});

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

// --- Register thường ---
router.post("/register", async (req, res) => {
  try {
    const { full_name, email, password, role, roomId } = req.body;
    console.log("[Register] Payload:", req.body);
    console.log("[Register] Creating user:", full_name, email);
    if (role === "student") console.log("[Register] Verified Room:", roomId);

    // ✅ Kiểm tra thông tin đầu vào
    if (!full_name || !email || !password || !role) {
      console.log("[Register] ❌ Thiếu thông tin đăng ký.");
      return res
        .status(400)
        .json({ message: "Thiếu thông tin đăng ký", status: "error" });
    }

    if (role === "student" && !roomId) {
      console.log("[Register] ❌ Học viên chưa nhập mã phòng thi.");
      return res
        .status(400)
        .json({ message: "Học viên cần mã phòng thi", status: "error" });
    }

    // ✅ Kiểm tra định dạng email hợp lệ
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log(`[Register] ❌ Email không hợp lệ: ${email}`);
      return res
        .status(400)
        .json({ message: "Định dạng email không hợp lệ", status: "error" });
    }

    // ✅ Kiểm tra domain email có thật (MX record)
    const domain = email.split("@")[1];
    try {
      const mxRecords = await dns.resolveMx(domain);

      if (!mxRecords || mxRecords.length === 0) {
        console.log(
          `[Register] ❌ Domain "${domain}" không tồn tại (MX trống).`
        );
        return res.status(400).json({
          message: "Email không tồn tại hoặc không thể nhận thư.",
          status: "error",
        });
      }

      console.log(
        `[Register] ✅ Domain "${domain}" hợp lệ (MX records found).`
      );
    } catch (dnsErr) {
      console.log(
        `[Register] ❌ Lỗi xác minh domain "${domain}":`,
        dnsErr.message
      );
      console.log(
        "[Register] Email đăng ký không tồn tại hoặc không thể xác minh!"
      );
      return res.status(400).json({
        message:
          "Không thể xác minh email này. Vui lòng nhập email thật hoặc kiểm tra lại chính tả.",
        status: "error",
      });
    }

    // ✅ Kiểm tra email đã tồn tại trong DB chưa
    const existingUser = await User.findOne({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      console.log(`[Register] ❌ Email đã tồn tại trong hệ thống: ${email}`);
      return res
        .status(400)
        .json({ message: "Email đã được đăng ký", status: "error" });
    }

    // ✅ Kiểm tra email đã được xác minh OTP chưa
    const emailKey = email.toLowerCase().trim();
    const otpData = otpStorage.get(emailKey);

    if (!otpData || !otpData.verified) {
      console.log(`[Register] ❌ Email chưa được xác minh OTP: ${email}`);
      return res.status(400).json({
        message:
          "Email chưa được xác minh. Vui lòng xác minh email trước khi đăng ký",
        status: "error",
      });
    }

    // ✅ Mã hóa mật khẩu & tạo user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      full_name,
      email: email.toLowerCase().trim(),
      password_hash: hashedPassword,
      role,
      created_at: new Date(),
    });

    console.log(`[Register] ✅ Tạo user mới thành công: ${email}`);

    // ✅ Nếu là học viên → kiểm tra phòng thi & liên kết
    if (role === "student") {
      try {
        const exam = await getExamByRoom(roomId);
        if (!exam) {
          console.log(`[Register] ❌ Mã phòng thi không hợp lệ: ${roomId}`);
          return res
            .status(400)
            .json({ message: "Mã phòng thi không hợp lệ", status: "error" });
        }

        await UserVerifiedRoom.create({
          user_id: newUser.id,
          exam_room_code: exam.exam_room_code,
        });
        console.log(
          `[Register] ✅ Đã liên kết học viên (ID: ${newUser.id}) với phòng thi: ${exam.exam_room_code}`
        );
      } catch (examErr) {
        console.log(
          `[Register] ⚠️ Lỗi khi xử lý mã phòng thi:`,
          examErr.message
        );
        return res
          .status(500)
          .json({ message: "Lỗi khi xác minh phòng thi", status: "error" });
      }
    }

    // ✅ Xóa OTP data sau khi đăng ký thành công
    otpStorage.delete(emailKey);
    console.log(`[Register] 🗑️ Đã xóa OTP data cho email: ${email}`);

    // ✅ Tạo JWT token & trả phản hồi
    const token = generateToken(newUser);
    console.log(`[Register] 🎉 Đăng ký thành công cho user: ${email}`);

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

    // ✅ 1. Kiểm tra thông tin đầu vào
    if (!email || !password) {
      console.log("[Login] ❌ Thiếu email hoặc mật khẩu.");
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ email và mật khẩu",
        status: "error",
      });
    }

    // ✅ 2. Kiểm tra định dạng email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log(`[Login] ❌ Email không hợp lệ: ${email}`);
      return res
        .status(400)
        .json({ message: "Địa chỉ email không hợp lệ", status: "error" });
    }

    // ✅ 3. Kiểm tra domain email có tồn tại không (MX check)
    const domain = email.split("@")[1];
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        console.log(`[Login] ❌ Domain email "${domain}" không tồn tại.`);
        return res.status(400).json({
          message: "Email này không tồn tại hoặc không thể nhận thư.",
          status: "error",
        });
      }
      console.log(`[Login] ✅ Domain "${domain}" hợp lệ (MX records found).`);
    } catch (dnsErr) {
      console.log(
        `[Login] ❌ Lỗi xác minh domain "${domain}":`,
        dnsErr.message
      );
      return res.status(400).json({
        message: "Không thể xác minh tên miền email, vui lòng kiểm tra lại.",
        status: "error",
      });
    }

    // ✅ 4. Kiểm tra tài khoản trong DB
    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      console.log(`[Login] ❌ Không tìm thấy tài khoản với email: ${email}`);
      return res.status(404).json({
        message: "Không tìm thấy tài khoản",
        status: "error",
      });
    }

    // ✅ 5. Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      console.log(`[Login] ❌ Sai mật khẩu cho tài khoản: ${email}`);
      return res.status(400).json({
        message: "Mật khẩu không chính xác",
        status: "error",
      });
    }

    // ✅ 6. Kiểm tra quyền và mã phòng thi (nếu là học viên)
    if (role === "student") {
      if (!roomId) {
        console.log("[Login] ❌ Học viên chưa nhập mã phòng thi.");
        return res
          .status(400)
          .json({ message: "Học viên cần mã phòng thi", status: "error" });
      }

      const exam = await getExamByRoom(roomId);
      if (!exam) {
        console.log(`[Login] ❌ Mã phòng thi không hợp lệ: ${roomId}`);
        return res
          .status(400)
          .json({ message: "Mã phòng thi không hợp lệ", status: "error" });
      }

      const verified = await UserVerifiedRoom.findOne({
        where: { user_id: user.id, exam_room_code: exam.exam_room_code },
      });

      if (!verified) {
        await UserVerifiedRoom.create({
          user_id: user.id,
          exam_room_code: exam.exam_room_code,
        });
        console.log(
          `[Login] ➕ Đã tự động liên kết user (ID: ${user.id}) với phòng thi: ${exam.exam_room_code}`
        );
      } else {
        console.log(
          `[Login] ✅ Học viên đã có liên kết phòng thi: ${exam.exam_room_code}`
        );
      }
    }

    // ✅ 7. Tạo JWT token và phản hồi
    const token = generateToken(user);
    console.log(`[Login] ✅ Đăng nhập thành công cho user: ${email}`);

    return res.json({
      message: "Đăng nhập thành công",
      status: "success",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("❌ Lỗi đăng nhập:", err);
    return res.status(500).json({
      message: "Lỗi server",
      status: "error",
    });
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

// kiểm tra email có tồn tại trước khi gửi OTP
router.post("/check-email", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email là bắt buộc" });

    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) {
      return res.json({ exists: false });
    }

    return res.json({ exists: true });
  } catch (err) {
    console.error("check-email error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

// Gửi OTP cho quên mật khẩu
router.post("/forgot-send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email là bắt buộc" });
    }

    const cleanEmail = email.toLowerCase().trim();

    const otp = Math.floor(100000 + Math.random() * 900000)
      .toString()
      .padStart(6, "0");

    otpStorage.set(cleanEmail, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    // Gửi OTP qua email
    const result = await sendOTPEmail(cleanEmail, otp);

    if (result.success) {
      console.log(`✅ OTP ${otp} đã gửi đến ${cleanEmail}`);
      return res.json({ success: true, message: "OTP đã được gửi!" });
    } else {
      return res.status(500).json({ message: "Gửi email thất bại" });
    }
  } catch (err) {
    console.error("❌ forgot-send-otp error:", err);
    return res.status(500).json({ message: "Lỗi server khi gửi OTP" });
  }
});

module.exports = router;
