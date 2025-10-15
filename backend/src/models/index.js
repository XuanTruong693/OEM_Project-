import sequelize from '../config/db.js';
import User from './User.js';
import ExamRoom from './ExamRoom.js';
import StudentRoom from './StudentRoom.js';

const syncDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected');

    // Tạo bảng theo thứ tự để tránh FK lỗi:
    await User.sync();
    await ExamRoom.sync();
    await StudentRoom.sync();

    console.log('All models synchronized!');
  } catch (error) {
    console.error('DB sync error:', error);
  }
};

export {
  sequelize,
  User,
  ExamRoom,
  StudentRoom,
  syncDB,
};
