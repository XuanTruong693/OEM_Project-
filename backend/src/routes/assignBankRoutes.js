const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const {
  getExams,
  getExamDetails,
  deleteExam,
  publishExam,
} = require("../controllers/assignBankController");

router.get("/exams", verifyToken, getExams);

router.get("/exams/:id", verifyToken, getExamDetails);

router.delete("/exams/:id", verifyToken, deleteExam);

router.post("/exams/:id/publish", verifyToken, publishExam);

module.exports = router;
