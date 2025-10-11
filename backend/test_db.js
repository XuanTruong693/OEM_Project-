import { db } from './config/db.js';

db.query('SELECT NOW() AS `current_time`', (err, results) => {
  if (err) {
    console.error('❌ Lỗi khi truy vấn:', err);
  } else {
    console.log('🕒 Kết nối thành công! Thời gian hiện tại:', results[0].current_time);
  }
  db.end(); // đóng kết nối
});
