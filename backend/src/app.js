import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/info", (req, res) => {
  res.json({ name: "OEM Backend", description: "Hệ thống đắc lực hỗ trợ thi trực tuyến hiệu quả", version: "1.0.0" });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
