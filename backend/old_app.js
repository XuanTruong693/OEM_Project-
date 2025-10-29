const express = require('express');
const app = express();
const sequelize = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const examRoomRoutes = require('./src/routes/examRoomRoutes');
// console.log("📦 authRoutes:", typeof authRoutes);
// console.log("📦 examRoomRoutes:", typeof examRoomRoutes);
// console.log("📦 authRoutes value:", authRoutes);
// console.log("📦 examRoomRoutes value:", examRoomRoutes);

app.use(express.json());

app.use('/auth', authRoutes);
app.use('/exam_rooms', examRoomRoutes);

sequelize.authenticate()
  .then(() => {
    console.log('✅ DB connected');
    return sequelize.sync();
  })
  .then(() => {
    console.log('✅ Models synchronized');
  })
  .catch(err => {
    console.error('❌ DB sync error:', err);
  });

module.exports = app;
