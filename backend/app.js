const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Sample API
app.get("/api/info", (req, res) => {
  res.json({
    name: "OEM Mini",
    description: "Hệ thống đắc lực hỗ trợ thi trực tuyến hiệu quả",
    version: "1.0.0"
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
