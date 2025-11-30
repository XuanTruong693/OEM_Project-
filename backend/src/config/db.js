const { Sequelize } = require("sequelize");
const mysql = require('mysql2/promise');
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

// MySQL2 Connection Pool for raw SQL queries (used in submissionController)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: process.env.APP_TZ || '+07:00'
});

module.exports = sequelize;
module.exports.pool = pool;
