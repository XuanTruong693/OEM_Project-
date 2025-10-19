const express = require("express");
const router = express.Router();
const sequelize = require("../config/db");
const { verifyToken, authorizeRole } = require("../middleware/authMiddleware");

// ==============================
// 📊 1️⃣ API: Lấy thống kê tổng
// ==============================
router.get(
  "/dashboard",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      const instructorId = req.user.id;

      const [results] = await sequelize.query(
        `
        SELECT
          COUNT(DISTINCT e.id) AS total_exams_created,
          COUNT(DISTINCT s.id) AS total_tests_submitted,
          COUNT(DISTINCT s.user_id) AS total_students_participated
        FROM courses c
        LEFT JOIN exams e ON e.course_id = c.id
        LEFT JOIN submissions s ON s.exam_id = e.id
        WHERE c.instructor_id = ?;
        `,
        { replacements: [instructorId], type: sequelize.QueryTypes.SELECT }
      );

      res.json(results);
    } catch (err) {
      console.error("❌ Error fetching dashboard stats:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// =======================================
// 📅 2️⃣ API: Lấy thống kê theo tháng (T1–T12)
// =======================================
router.get(
  "/dashboard/monthly",
  verifyToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    try {
      const instructorId = req.user.id;

      const rows = await sequelize.query(
        `
        SELECT 
          MONTH(e.created_at) AS month,
          COUNT(DISTINCT e.id) AS exams_created,
          COUNT(DISTINCT s.user_id) AS students_participated
        FROM courses c
        LEFT JOIN exams e ON e.course_id = c.id
        LEFT JOIN submissions s ON s.exam_id = e.id
        WHERE c.instructor_id = ?
        GROUP BY MONTH(e.created_at)
        ORDER BY month;
        `,
        { replacements: [instructorId], type: sequelize.QueryTypes.SELECT }
      );

      // Bổ sung các tháng không có dữ liệu
      const fullMonths = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        return (
          rows.find((r) => r.month === m) || {
            month: m,
            exams_created: 0,
            students_participated: 0,
          }
        );
      });

      res.json(fullMonths);
    } catch (err) {
      console.error("❌ Error fetching monthly stats:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// =======================================
// 👤 3️⃣ API: Lấy thông tin user theo ID
// =======================================
router.get("/user/info", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [user] = await sequelize.query(
      "SELECT id, full_name, email, role FROM users WHERE id = ?",
      { replacements: [userId], type: sequelize.QueryTypes.SELECT }
    );

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("❌ Error fetching user info:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
