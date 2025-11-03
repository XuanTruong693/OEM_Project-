const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// --- Model User ---
const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    full_name: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    role: {
      type: DataTypes.ENUM("admin", "instructor", "student"),
      allowNull: false,
    },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    // Optional profile fields added in migrations: keep names matching controller expectations
    avatar: { type: DataTypes.STRING(255), allowNull: true },
    // store binary blob and mimetype for streaming avatars
    avatar_blob: {
      type: DataTypes.BLOB("long"),
      allowNull: true,
      field: "avatar_blob",
    },
    avatar_mimetype: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "avatar_mimetype",
    },
    gender: {
      type: DataTypes.ENUM("male", "female", "other"),
      allowNull: true,
    },
    address: { type: DataTypes.STRING(255), allowNull: true },
    // DB column is phone_number in migrations; expose as `phone` on the model for controller compatibility
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "phone_number",
    },
  },
  { tableName: "users", timestamps: false }
);

// --- Model UserVerifiedRoom ---
const UserVerifiedRoom = sequelize.define(
  "UserVerifiedRoom",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    exam_room_code: { type: DataTypes.STRING(20), allowNull: false },
    verified_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "user_verified_rooms",
    timestamps: false,
    indexes: [{ unique: true, fields: ["user_id", "exam_room_code"] }],
  }
);

module.exports = { User, UserVerifiedRoom };
