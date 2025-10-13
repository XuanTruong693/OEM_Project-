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
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("admin","instructor", "student"),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verify_room_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "users",      
    timestamps: false,      
  }
);

module.exports = User;

