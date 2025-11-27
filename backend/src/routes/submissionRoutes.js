const express = require("express");
const submissionController = require("../controllers/submissionController");

const router = express.Router();

router.post(
  "/:submissionId/proctor-event",
  submissionController.postProctorEvent
);

router.get("/exams/:examId/violations", submissionController.getExamViolations);

router.get(
  "/exams/:examId/students/:studentId/detail",
  submissionController.getStudentExamDetail
);

router.put(
  "/exams/:examId/students/:studentId/approve",
  submissionController.approveStudentScores
);

router.get("/exams/:examId/results", submissionController.getExamResults);

router.delete(
  "/exams/:examId/students/:studentId",
  submissionController.deleteStudentExamRecord
);

module.exports = router;
