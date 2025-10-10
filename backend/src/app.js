import express from "express";
import cors from "cors";
import dotenv from "dotenv";
// ❌ Tạm thời tắt kết nối DB (vì bạn chưa có)
// import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import examRoomRoutes from "./routes/examRoomRoutes.js";

dotenv.config();

// ✅ Tạm thời bỏ gọi connectDB để tránh lỗi
// connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// Đăng ký route
app.use("/api/auth", authRoutes);
app.use("/api/exam-room", examRoomRoutes);

// Kiểm tra server
app.get("/", (req, res) => {
  res.send("✅ OEM API running (in-memory mode)");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
