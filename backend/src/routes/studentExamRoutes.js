const express = require("express");
const router = express.Router();
const multer = require("multer");

const {
  verifyRoom,
  joinExam,
  startExam,
  saveAnswer,
  submitExam,
  uploadVerifyAssets,
  myResults,
  getExamPublicInfo,
  getSubmissionStatus,
} = require("../controllers/studentExamController");

// Import proctor event handler from submission controller
const { postProctorEvent } = require("../controllers/submissionController");

const { verifyToken } = require("../middleware/authMiddleware");
const { requireRoomVerification } = require("../middleware/verifyRoomMiddleware");
const upload = multer({ storage: multer.memoryStorage() });

// Exams
router.post("/exams/verify-room", verifyRoom); 
router.post("/exams/join", verifyToken, joinExam); 
router.get("/exams/:id/public-info", verifyToken, requireRoomVerification, getExamPublicInfo);

// Submissions - Tất cả đều cần verify room
router.get("/submissions/:id/status", verifyToken, requireRoomVerification, getSubmissionStatus);
router.post("/submissions/:id/verify", verifyToken, requireRoomVerification, upload.fields([
  { name: "face_image", maxCount: 1 },
  { name: "student_card_image", maxCount: 1 },
]), uploadVerifyAssets);

router.post("/submissions/:id/start", verifyToken, requireRoomVerification, startExam);
router.post("/submissions/:id/answer", verifyToken, requireRoomVerification, saveAnswer);

router.post("/submissions/:id/proctor-event", verifyToken, requireRoomVerification, postProctorEvent);

router.post("/submissions/:id/submit", verifyToken, requireRoomVerification, submitExam);

// Results
router.get("/results/my", verifyToken, myResults);

module.exports = router;
