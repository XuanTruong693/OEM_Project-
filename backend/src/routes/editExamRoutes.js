// routes/editExamRoutes.js
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const {
  getExamForEdit,
  updateExam,
} = require("../controllers/editExamController");

router.get("/exams/:id/edit", verifyToken, getExamForEdit);
router.put("/exams/:id", verifyToken, updateExam);

module.exports = router;
