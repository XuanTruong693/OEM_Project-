const express = require("express");
const router = express.Router();
const multer = require("multer");

const {
  verifyRoom,
  joinExam,
  startExam,
  saveAnswer,
  submitExam,
  proctorEvent,
  uploadVerifyAssets,
  myResults,
  getExamPublicInfo,
} = require("../controllers/studentExamController");

const { verifyToken } = require("../middleware/authMiddleware");

// Use memory storage for small verification images (face/card)
const upload = multer({ storage: multer.memoryStorage() });

// Exams
router.post("/exams/verify-room", verifyRoom); // no auth required
router.post("/exams/join", verifyToken, joinExam);
router.get("/exams/:id/public-info", verifyToken, getExamPublicInfo);

// Submissions
router.post("/submissions/:id/verify", verifyToken, upload.fields([
  { name: "face_image", maxCount: 1 },
  { name: "student_card_image", maxCount: 1 },
]), uploadVerifyAssets);

router.post("/submissions/:id/start", verifyToken, startExam);
router.post("/submissions/:id/answer", verifyToken, saveAnswer);
router.post("/submissions/:id/proctor-event", verifyToken, proctorEvent);
router.post("/submissions/:id/submit", verifyToken, submitExam);

// Results
router.get("/results/my", verifyToken, myResults);

module.exports = router;
