// test_db.js
require("dotenv").config();
const sequelize = require("./src/config/db");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Đã kết nối tới MySQL Database:", process.env.DB_NAME);

    const [results] = await sequelize.query("SELECT NOW() AS currentTime;");
    console.log(
      "🕒 Kết nối thành công! Thời gian hiện tại:",
      results[0].currentTime
    );
  } catch (error) {
    console.error("❌ Kết nối MySQL thất bại:", error.message);
  } finally {
    await sequelize.close();
  }
})();
