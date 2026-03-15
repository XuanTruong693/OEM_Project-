const express = require("express");
const submissionController = require("../controllers/submissionController");
const snapshotController = require("../controllers/snapshotController");

const router = express.Router();

router.post(
  "/submissions/:submissionId/proctor-event",
  submissionController.postProctorEvent
);

router.post(
  "/submissions/:submissionId/snapshots",
  snapshotController.uploadSnapshots
);

router.post(
  "/submissions/:submissionId/videos/merge",
  snapshotController.mergeToVideo
);

router.get("/exams/:examId/violations", submissionController.getExamViolations);

router.get(
  "/exams/:examId/students/:studentId/detail",
  submissionController.getStudentExamDetail
);

router.get(
  "/submissions/:submissionId/cheating-details",
  submissionController.getStudentCheatingDetails
);

// Lấy câu hỏi và đáp án của sinh viên
router.get(
  "/submissions/:submissionId/questions",
  submissionController.getSubmissionQuestions
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
