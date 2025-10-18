require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sequelize = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const examRoomRoutes = require("./routes/examRoomRoutes");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Log debug chỉ khi chạy dev
if (process.env.NODE_ENV === "development") {
  console.log("📦 authRoutes:", typeof authRoutes);
  console.log("📦 examRoomRoutes:", typeof examRoomRoutes);
  console.log("📦 authRoutes value:", authRoutes);
  console.log("📦 examRoomRoutes value:", examRoomRoutes);
}

// ✅ Mount routes
app.use("/auth", authRoutes);
app.use("/exam_rooms", examRoomRoutes);

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
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB connection error:", err);
  });

module.exports = app;