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
      type: DataTypes.BLOB('long'), 
      allowNull: true,
      comment: 'Blob ảnh thẻ sinh viên (old column)',
    },
    card_image_blob: {
      type: DataTypes.BLOB('long'),
      allowNull: false,
      defaultValue: '', // Để tránh lỗi NOT NULL nếu không có ảnh
      comment: 'Ảnh thẻ thực tế đang dùng trong DB',
    },
    card_image_mimetype: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'image/jpeg',
    },
  },
  {
    tableName: 'student_cards',
    timestamps: true,
    underscored: true,
  }
);

module.exports = StudentCard;
