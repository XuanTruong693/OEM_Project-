import mongoose from "mongoose";

const examRoomSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: String,
});

export default mongoose.model("ExamRoom", examRoomSchema);
