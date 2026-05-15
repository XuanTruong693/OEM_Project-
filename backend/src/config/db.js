const { Sequelize } = require("sequelize");
const mysql = require('mysql2/promise');
require("dotenv").config();
// Primary Database Connection (oem_mini) - Business Data
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    port: process.env.DB_PORT,
    logging: false,
    timezone: process.env.APP_TZ || "+07:00",
    pool: {
      max: 400,
      min: 0,
      acquire: 15000, // Thất bại nhanh sau 5s để thử lại đợt mới
      idle: 30000
    },
    dialectOptions: {
      charset: 'utf8mb4',
      connectTimeout: 5000 // Thất bại nhanh sau 5s
    }
  }
);

// MySQL2 Connection Pool for raw SQL queries
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 400, // Đồng bộ lên 400 kết nối
  queueLimit: 0,
  connectTimeout: 5000, // Thất bại nhanh sau 5s để đồng bộ
  timezone: process.env.APP_TZ || '+07:00',
  charset: 'utf8mb4'
});

// Fix SQL mode ONLY_FULL_GROUP_BY issue at global level
const initializePool = async () => {
  try {
    // Set SQL mode at session level for this connection pattern
    await pool.query("SET GLOBAL sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))");
    console.log('✅ [DB] SQL mode ONLY_FULL_GROUP_BY disabled');
  } catch (error) {
    // If GLOBAL fails (no SUPER privilege), try SESSION on each query
    console.warn('⚠️ [DB] Could not set GLOBAL sql_mode, trying SESSION approach:', error.message);
    try {
      await pool.query("SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))");
      console.log('✅ [DB] SQL mode fixed at SESSION level');
    } catch (err) {
      console.warn('⚠️ [DB] Could not fix SQL mode:', err.message);
    }
  }

  // Ensure users table has fcm_token column
  try {
    await pool.query("ALTER TABLE users ADD COLUMN fcm_token VARCHAR(255) NULL");
    console.log('✅ [DB] fcm_token column created successfully');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
      console.log('✅ [DB] fcm_token column verified (already exists)');
    } else {
      console.warn('⚠️ [DB] Could not verify fcm_token column:', err.message);
    }
  }
};

// Run init
initializePool();
// Admin Database Connection (oem_admin) - Admin Metadata
const ADMIN_DB_NAME = process.env.ADMIN_DB_NAME || 'oem_admin';

const adminSequelize = new Sequelize(
  ADMIN_DB_NAME,
  process.env.ADMIN_DB_USER || process.env.DB_USER,
  process.env.ADMIN_DB_PASSWORD || process.env.DB_PASSWORD,
  {
    host: process.env.ADMIN_DB_HOST || process.env.DB_HOST,
    dialect: "mysql",
    port: process.env.ADMIN_DB_PORT || process.env.DB_PORT,
    logging: false,
    timezone: process.env.APP_TZ || "+07:00",
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      charset: 'utf8mb4',
      connectTimeout: 10000
    }
  }
);

// Admin MySQL2 Connection Pool for raw SQL queries
const adminPool = mysql.createPool({
  host: process.env.ADMIN_DB_HOST || process.env.DB_HOST,
  user: process.env.ADMIN_DB_USER || process.env.DB_USER,
  password: process.env.ADMIN_DB_PASSWORD || process.env.DB_PASSWORD,
  database: ADMIN_DB_NAME,
  port: process.env.ADMIN_DB_PORT || process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  timezone: process.env.APP_TZ || '+07:00',
  charset: 'utf8mb4'
});

// Test connections on startup
const testConnections = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ [DB] Primary database (oem_mini) connected successfully');
  } catch (error) {
    console.error('❌ [DB] Primary database connection failed:', error.message);
  }

  try {
    await adminSequelize.authenticate();
    console.log('✅ [DB] Admin database (oem_admin) connected successfully');
  } catch (error) {
    console.warn('⚠️ [DB] Admin database connection failed (will create if not exists):', error.message);
  }
};

// Run connection test
testConnections();

// Exports
module.exports = sequelize;
module.exports.pool = pool;
module.exports.adminSequelize = adminSequelize;
module.exports.adminPool = adminPool;

