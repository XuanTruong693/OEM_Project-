const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

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
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    duration_minutes: { type: DataTypes.INTEGER, allowNull: true },
    time_open: { type: DataTypes.DATE, allowNull: true },
    time_close: { type: DataTypes.DATE, allowNull: true },
    max_points: { type: DataTypes.FLOAT, allowNull: true },
    require_face_check: { type: DataTypes.BOOLEAN, allowNull: true },
    require_student_card: { type: DataTypes.BOOLEAN, allowNull: true },
    monitor_screen: { type: DataTypes.BOOLEAN, allowNull: true },
    max_attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },

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
    timestamps: true,
    underscored: true,
  }
);

module.exports = Exam;
