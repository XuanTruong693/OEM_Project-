const express = require('express');
const cors = require('cors');
const app = express();
const sequelize = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const examRoomRoutes = require('./routes/examRoomRoutes');


app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/exam_rooms', examRoomRoutes);

const PORT = process.env.PORT || 5000;

sequelize.authenticate()
  .then(() => {
    console.log('✅ DB connected');
    return Promise.resolve();
  })
  .then(() => {
    console.log('✅ Models synchronized');
    app.listen(PORT, () => {
      console.log(`🚀 Server is running at http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ DB sync error:', err);
  });


module.exports = app;
