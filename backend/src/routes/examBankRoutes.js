const express = require("express");
const router = express.Router();
const multer = require("multer");
const { checkExcelSheets, importExamQuestions } = require("../controllers/examBankController");
const { verifyToken, authorizeRole } = require("../middleware/authMiddleware");

// Configure multer for file uploads (memory storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.mimetype === "application/vnd.ms-excel") {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file Excel (.xlsx, .xls)"));
    }
  }
});

// Check Excel sheets - Kiểm tra sheets trong file
router.post(
  "/check-sheets",
  verifyToken,
  authorizeRole(["instructor", "admin"]),
  upload.single("file"),
  checkExcelSheets
);

// Import exam questions from Excel preview
router.post(
  "/import-commit",
  verifyToken,
  authorizeRole(["instructor", "admin"]),
  importExamQuestions
);

module.exports = router;
