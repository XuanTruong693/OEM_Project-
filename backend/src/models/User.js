const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    full_name: {
      type: DataTypes.STRING(100), // ✅ Khớp DB
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(120), // ✅ Khớp DB
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("admin", "instructor", "student"),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW, 
    },
    verify_room_code: {
      type: DataTypes.STRING(20), 
      allowNull: true,
    },
  },
  {
    tableName: "users",
    timestamps: false, 
  }
);

module.exports = User;
