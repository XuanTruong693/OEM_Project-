const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Model: StudentCard
 * Bảng lưu thẻ sinh viên (kèm ảnh blob) do Admin quản lý.
 * Dùng để đối chiếu khi SV tham gia thi.
 */
const StudentCard = sequelize.define(
  'StudentCard',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    student_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: 'Mã số sinh viên (MSSV) — duy nhất',
    },
    student_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: 'Họ và tên sinh viên',
    },
    card_image: {
      type: DataTypes.BLOB('long'), // LONGBLOB — lưu file ảnh trực tiếp vào DB
      allowNull: true,
      comment: 'Blob ảnh thẻ sinh viên',
    },
  },
  {
    tableName: 'student_cards',
    timestamps: true,          // Sequelize tự tạo createdAt / updatedAt
    underscored: true,         // map createdAt → created_at, updatedAt → updated_at
  }
);

module.exports = StudentCard;
