const express = require("express");
const router = express.Router();
const { importExamQuestions, listRecentImports, getImportRows, getExamFile } = require("../controllers/examBankController");
const { importFromExcel, upload } = require("../controllers/examController");
const { verifyToken, authorizeRole } = require("../middleware/authMiddleware");

// Import exam questions from Excel preview (old)
router.post(
  "/import-commit",
  verifyToken,
  authorizeRole(["instructor", "admin"]),
  importExamQuestions
);

// Import exam from Excel (new - with proper duration handling)
router.post(
  "/import-excel", 
  verifyToken,
  authorizeRole(["instructor", "admin"]),
  upload.single('file'),
  importFromExcel
);

// Extra verify endpoints to see saved jobs
router.get(
  "/imports/recent",
  verifyToken,
  authorizeRole(["instructor", "admin"]),
  listRecentImports
);

router.get(
  "/imports/:jobId/rows",
  verifyToken,
  authorizeRole(["instructor", "admin"]),
  getImportRows
);

router.get(
  "/file/:examId",
  verifyToken,
  authorizeRole(["instructor", "admin"]),
  getExamFile
);

module.exports = router;
