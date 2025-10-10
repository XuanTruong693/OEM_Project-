import express from "express";
import { verifyRoom } from "../controllers/examRoomController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/verify/:code", verifyToken, verifyRoom);

export default router;
