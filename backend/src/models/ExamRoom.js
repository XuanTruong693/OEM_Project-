const { DataTypes } = require("sequelize");

const sequelize = require("../config/db");



const Exam = sequelize.define(

  "Exam",

  {

    id: {

      type: DataTypes.INTEGER,

      autoIncrement: true,

      primaryKey: true,

    },

    course_id: {

      type: DataTypes.INTEGER,

      allowNull: false,

      

     references: {

       model: 'courses',

      key: 'id'

      }

    },

    title: {

      type: DataTypes.STRING(100),

      allowNull: false,

    },

    duration: {

      type: DataTypes.INTEGER, 

      allowNull: false,

    },

    exam_room_code: {

      type: DataTypes.STRING(20),

      allowNull: false,

      unique: true,

    },

    status: {

      type: DataTypes.ENUM('draft', 'published', 'archived'),

      allowNull: false,

      defaultValue: 'draft',

    },

  },

  {

    tableName: "exams", 

    timestamps: true,

    underscored: true, 

  }

);



module.exports = Exam;