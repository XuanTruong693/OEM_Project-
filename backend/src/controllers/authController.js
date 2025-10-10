import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";

export const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already registered", status: "error" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ firstName, lastName, email, password: hashed });

    const token = generateToken(user);
    res.status(201).json({ message: "Register success", status: "success", token, role: user.role });
  } catch {
    res.status(500).json({ message: "Server error", status: "error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found", status: "error" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid password", status: "error" });

    const token = generateToken(user);
    res.status(200).json({ message: "Login success", status: "success", token, role: user.role });
  } catch {
    res.status(500).json({ message: "Server error", status: "error" });
  }
};
