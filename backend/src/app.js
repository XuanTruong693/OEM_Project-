require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sequelize = require("./config/db");
const path = require("path");
const http = require("http");
const { initializeSocket } = require("./services/socketService");
const authRoutes = require("./routes/authRoutes");
const examRoomRoutes = require("./routes/examRoomRoutes");
const instructorRoutes = require("./routes/instructorRoutes");
const profileRoutes = require("./routes/profileRoutes");
const adminRoutes = require("./routes/adminRoutes");
const examBankRoutes = require("./routes/examBankRoutes");
const assignBankRoutes = require("./routes/assignBankRoutes");
const editExamRoutes = require("./routes/editExamRoutes");
const studentExamRoutes = require("./routes/studentExamRoutes");
const submissionRoutes = require("./routes/submissionRoutes");
const { getAppRole, setAppRole } = require("./utils/appRole");
const app = express();
// const profileRouter = require("./routes/profile");

const allowedOrigins = ["http://localhost:4000", "http://127.0.0.1:4000"];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn("❌ Blocked CORS from:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Serve uploaded verification images if *_url columns are used
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Log debug chỉ khi chạy dev
if (process.env.NODE_ENV === "development") {
  // console.log("📦 authRoutes:", typeof authRoutes);
  // console.log("📦 examRoomRoutes:", typeof examRoomRoutes);
  // console.log("📦 authRoutes value:", authRoutes);
  // console.log("📦 examRoomRoutes value:", examRoomRoutes);
  // console.log("📦 profileRoutes mounted at /api/profile")
}

// ✅ Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/exam_rooms", examRoomRoutes);
app.use("/api/instructor", instructorRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/exam-bank", examBankRoutes);
app.use("/api/assign-bank", assignBankRoutes);
app.use("/api/edit-exam", editExamRoutes);
app.use("/api", studentExamRoutes); // Includes proctor event handler

// Submission routes for instructor (results, violations, etc.)
app.use("/api/instructor", submissionRoutes);

// Root-level role endpoints to support http://localhost:4000/role via Vite proxy
app.get("/role", (req, res) => {
  res.json({ role: getAppRole() });
});
app.post("/role", (req, res) => {
  const { role } = req.body || {};
  if (!role) return res.status(400).json({ message: "Role is required" });
  setAppRole(role);
  res.json({ role: getAppRole() });
});

// ✅ Route test
app.get("/", (req, res) => {
  res.send("✅ Backend OEM API is running...");
});

const PORT = process.env.PORT || 5000;

// ✅ Kết nối và đồng bộ DB
sequelize
  .authenticate()
  .then(() => {
    console.log("✅ DB connected successfully");
    if (process.env.NODE_ENV !== "test") {
      // ✅ Tạo HTTP server và khởi tạo Socket.IO
      const httpServer = http.createServer(app);
      initializeSocket(httpServer);

      httpServer.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
        console.log(`🔌 WebSocket server initialized`);
      });
    }
  })
  .catch((err) => {
    console.error("❌ DB connection error:", err);
  });

module.exports = app;
