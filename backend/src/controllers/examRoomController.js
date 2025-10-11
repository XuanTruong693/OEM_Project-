import ExamRoom from "../models/ExamRoom.js";
import User from "../models/User.js";

export const verifyRoom = async (req, res) => {
  try {
    const { code } = req.params;
    const room = await ExamRoom.findOne({ code });

    if (!room) return res.status(404).json({ message: "Invalid room code", status: "error" });

    if (req.user && req.user.role === "student") {
      await User.findByIdAndUpdate(req.user.id, { verifiedRoomId: room._id });
    }

    return res.status(200).json({ message: "Room verified", status: "success", valid: true, roomId: room._id });
  } catch {
    res.status(500).json({ message: "Server error", status: "error" });
  }
};
