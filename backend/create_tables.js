const mysql = require('mysql2/promise');
require('dotenv').config();

async function createTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('🔄 Creating tables...');
    
    // Drop existing tables first
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('DROP TABLE IF EXISTS user_verified_rooms');
    await connection.execute('DROP TABLE IF EXISTS users');
    await connection.execute('DROP TABLE IF EXISTS exam_rooms');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    // Create users table
    await connection.execute(`
      CREATE TABLE users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(120) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        avatar VARCHAR(255) NULL,
        avatar_blob LONGBLOB NULL,
        avatar_mimetype VARCHAR(100) NULL,
        gender ENUM('male','female','other') NULL,
        address VARCHAR(255) NULL,
        phone_number VARCHAR(20) NULL,
        role ENUM('admin','instructor','student') NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_users_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Create exam_rooms table
    await connection.execute(`
      CREATE TABLE exam_rooms (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        exam_room_code VARCHAR(20) NOT NULL UNIQUE,
        exam_room_name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Create user_verified_rooms table
    await connection.execute(`
      CREATE TABLE user_verified_rooms (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        exam_room_code VARCHAR(20) NOT NULL,
        verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_room (user_id, exam_room_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ Tables created successfully');
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
  } finally {
    await connection.end();
  }
}

createTables();