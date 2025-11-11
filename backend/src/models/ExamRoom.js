const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// Sequelize model khớp schema mới của bảng `exams`
// - ĐÃ BỎ course_id
// - Có instructor_id (một số DB có thể để NULL nếu dữ liệu cũ)
// - Có thể có thêm các cột cấu hình (duration_minutes, time_open, time_close, max_points,
//   require_face_check, require_student_card, monitor_screen) — khai báo allowNull để tương thích

const Exam = sequelize.define(
  "Exam",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    instructor_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true, // một số DB cũ có thể đang NULL; BE nên set khi tạo mới
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Các cột mở rộng – nếu DB chưa có cũng không ảnh hưởng khi chỉ đọc
    duration_minutes: { type: DataTypes.INTEGER, allowNull: true },
    time_open: { type: DataTypes.DATE, allowNull: true },
    time_close: { type: DataTypes.DATE, allowNull: true },
    max_points: { type: DataTypes.FLOAT, allowNull: true },
    require_face_check: { type: DataTypes.BOOLEAN, allowNull: true },
    require_student_card: { type: DataTypes.BOOLEAN, allowNull: true },
    monitor_screen: { type: DataTypes.BOOLEAN, allowNull: true },

    exam_room_code: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      allowNull: false,
      defaultValue: "draft",
    },
  },
  {
    tableName: "exams",
    timestamps: true, // map tới created_at/updated_at vì underscored
    underscored: true,
  }
);

module.exports = Exam;
