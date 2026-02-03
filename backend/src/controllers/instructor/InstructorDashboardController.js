const sequelize = require("../../config/db");

/**
 * GET /api/instructor/dashboard
 * Get instructor dashboard statistics
 */
async function getDashboardStats(req, res) {
    try {
        const instructorId = req.user.id;

        const [results] = await sequelize.query(
            `
      SELECT 
        COUNT(DISTINCT e.id) AS total_exams_created,
        COUNT(DISTINCT s.id) AS total_tests_submitted,
        COUNT(DISTINCT s.user_id) AS total_students_participated,
        AVG(s.total_score) AS avg_score
      FROM exams e
      LEFT JOIN submissions s ON s.exam_id = e.id
      WHERE e.instructor_id = ?;
      `,
            { replacements: [instructorId], type: sequelize.QueryTypes.SELECT }
        );

        res.json(results);
    } catch (err) {
        console.error("❌ Error fetching dashboard stats:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * GET /api/instructor/dashboard/submissions
 * Get list of submissions for instructor's exams
 */
async function getDashboardSubmissions(req, res) {
    try {
        const instructorId = req.user.id;
        console.log("📋 Fetching submissions for instructor:", instructorId);

        const [rows] = await sequelize.query(
            `
      SELECT 
        s.id AS submission_id,
        s.exam_id,
        e.title AS exam_title,
        s.user_id AS student_id,
        u.full_name AS student_name,
        u.email AS student_email,
        s.total_score,
        s.ai_score,
        s.suggested_total_score,
        s.submitted_at,
        s.status,
        s.attempt_no
      FROM submissions s
      JOIN exams e ON e.id = s.exam_id
      JOIN users u ON u.id = s.user_id
      WHERE e.instructor_id = ?
      ORDER BY s.submitted_at DESC
      `,
            { replacements: [instructorId] }
        );

        res.json(rows);
    } catch (err) {
        console.error("❌ Error fetching dashboard submissions:", err);
        res.status(500).json({
            message: "Internal server error",
            error: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
}

/**
 * GET /api/instructor/dashboard/students
 * Get distinct students who participated in instructor's exams
 */
async function getDashboardStudents(req, res) {
    try {
        const instructorId = req.user.id;

        const [rows] = await sequelize.query(
            `
      SELECT DISTINCT
        u.id AS student_id,
        u.full_name AS student_name,
        u.email AS student_email,
        COUNT(DISTINCT s.exam_id) AS exams_taken,
        AVG(s.total_score) AS avg_score
      FROM users u
      JOIN submissions s ON s.user_id = u.id
      JOIN exams e ON e.id = s.exam_id
      WHERE e.instructor_id = ?
      GROUP BY u.id, u.full_name, u.email
      ORDER BY avg_score DESC
      `,
            { replacements: [instructorId] }
        );

        res.json(rows);
    } catch (err) {
        console.error("❌ Error fetching dashboard students:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * GET /api/instructor/dashboard/monthly
 * Get monthly statistics for instructor (all 12 months)
 */
async function getDashboardMonthly(req, res) {
    try {
        const instructorId = req.user.id;

        // Generate all 12 months and LEFT JOIN with actual data
        const [rows] = await sequelize.query(
            `
      WITH months AS (
        SELECT 1 AS month UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 
        UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 
        UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
      ),
      monthly_stats AS (
        SELECT 
          MONTH(s.submitted_at) AS month,
          COUNT(DISTINCT e.id) AS exams_count,
          COUNT(DISTINCT s.user_id) AS students_count,
          AVG(s.total_score) AS avg_score
        FROM submissions s
        JOIN exams e ON e.id = s.exam_id
        WHERE e.instructor_id = ? AND YEAR(s.submitted_at) = YEAR(CURRENT_DATE())
        GROUP BY MONTH(s.submitted_at)
      )
      SELECT 
        m.month,
        COALESCE(ms.exams_count, 0) AS exams_created,
        COALESCE(ms.students_count, 0) AS students_participated,
        COALESCE(ms.avg_score, 0) AS avg_score
      FROM months m
      LEFT JOIN monthly_stats ms ON ms.month = m.month
      ORDER BY m.month
      `,
            { replacements: [instructorId] }
        );

        res.json(rows);
    } catch (err) {
        console.error("❌ Error fetching monthly stats:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

module.exports = {
    getDashboardStats,
    getDashboardSubmissions,
    getDashboardStudents,
    getDashboardMonthly,
};
