import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config(); // Đọc các biến trong file .env

export const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

// Kết nối để kiểm tra
db.connect((err) => {
  if (err) {
    console.error('❌ Kết nối MySQL thất bại:', err.message);
  } else {
    console.log(`✅ Đã kết nối tới MySQL Database: ${process.env.DB_NAME}`);
  }
});
