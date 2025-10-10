import jwt from "jsonwebtoken";

export const generateToken = (user) => {
  const payload = {
    id: user._id,
    role: user.role,
    verifiedRoomId: user.verifiedRoomId || null,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "2h" });
};
