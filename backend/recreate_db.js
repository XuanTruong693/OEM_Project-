const { User, UserVerifiedRoom } = require('./src/models/User');
const ExamRoom = require('./src/models/ExamRoom');
const sequelize = require('./src/config/db');

async function recreateDatabase() {
  try {
    console.log('🔄 Recreating database...');
    
    // Drop all foreign keys first
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Drop tables if exist
    await sequelize.query('DROP TABLE IF EXISTS user_verified_rooms');
    await sequelize.query('DROP TABLE IF EXISTS courses');
    await sequelize.query('DROP TABLE IF EXISTS users');
    await sequelize.query('DROP TABLE IF EXISTS exam_rooms');
    
    // Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    
    // Recreate tables
    await User.sync({ force: true });
    await ExamRoom.sync({ force: true });
    await UserVerifiedRoom.sync({ force: true });
    
    console.log('✅ Database recreated successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error recreating database:', error.message);
    process.exit(1);
  }
}

recreateDatabase();