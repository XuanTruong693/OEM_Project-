const express = require("express");
const router = express.Router();
const { importExamQuestions } = require("../controllers/examBankController");
const { verifyToken, authorizeRole } = require("../middleware/authMiddleware");

// Import exam questions from Excel preview
router.post(
  "/import-commit",
  verifyToken,
  authorizeRole(["instructor", "admin"]),
  importExamQuestions
);

module.exports = router;
