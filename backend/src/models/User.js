import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: String,
  role: {
    type: String,
    enum: ["student", "instructor", "admin"],
    default: "student",
  },
  verifiedRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ExamRoom",
    default: null,
  },
});

export default mongoose.model("User", userSchema);
