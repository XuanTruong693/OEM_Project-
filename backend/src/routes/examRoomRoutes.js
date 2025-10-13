const express = require("express");
const router = express.Router();
const { createExam, verifyExamCode } = require("../controllers/examRoomController");
const { authMiddleware, authorizeRole  } = require("../middleware/authMiddleware");

router.post("/verify", verifyExamCode);

router.post("/create", authMiddleware, authorizeRole("instructor"), createExam);

module.exports = router;

