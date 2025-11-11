const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    port: process.env.DB_PORT,
    logging: false,
    timezone: process.env.APP_TZ || "+07:00", // chuẩn hoá múi giờ VN cho phiên kết nối
  }
);

module.exports = sequelize;
