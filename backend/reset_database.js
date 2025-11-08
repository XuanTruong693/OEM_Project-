const mysql = require('mysql2/promise');
require('dotenv').config();

async function resetDatabase() {
  // First connection without database
  const connection1 = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  try {
    console.log('🔄 Resetting database...');
    
    // Drop and recreate database
    await connection1.query('DROP DATABASE IF EXISTS oem_mini');
    await connection1.query('CREATE DATABASE oem_mini CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    await connection1.end();
    
    // Second connection with database
    const connection2 = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'oem_mini'
    });
    
    // Create users table
    await connection2.query(`
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Create exam_rooms table
    await connection2.query(`
      CREATE TABLE exam_rooms (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        exam_room_code VARCHAR(20) NOT NULL UNIQUE,
        exam_room_name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Create user_verified_rooms table
    await connection2.query(`
      CREATE TABLE user_verified_rooms (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        exam_room_code VARCHAR(20) NOT NULL,
        verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_room (user_id, exam_room_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Insert a test exam room
    await connection2.query(`
      INSERT INTO exam_rooms (exam_room_code, exam_room_name, description) 
      VALUES ('TEST123', 'Test Room', 'Room for testing Google login')
    `);
    
    await connection2.end();
    console.log('✅ Database reset successfully');
  } catch (error) {
    console.error('❌ Error resetting database:', error.message);
  }
}

resetDatabase();