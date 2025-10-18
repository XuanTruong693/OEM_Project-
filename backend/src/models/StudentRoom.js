const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const User = require("./User");
const ExamRoom = require("./ExamRoom");

const StudentRoom = sequelize.define(
  "StudentRoom",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
      onDelete: "CASCADE",
    },
    room_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: ExamRoom,
        key: "id",
      },
      onDelete: "CASCADE",
    },
  },
  {
    tableName: "student_rooms",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["user_id", "room_id"],
      },
    ],
  }
);

User.hasMany(StudentRoom, { foreignKey: "user_id" });
StudentRoom.belongsTo(User, { foreignKey: "user_id" });

ExamRoom.hasMany(StudentRoom, { foreignKey: "room_id" });
StudentRoom.belongsTo(ExamRoom, { foreignKey: "room_id" });

module.exports = StudentRoom;
