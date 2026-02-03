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
  connectionLimit: 10,
  queueLimit: 0,
  timezone: process.env.APP_TZ || '+07:00'
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
  timezone: process.env.APP_TZ || '+07:00'
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

