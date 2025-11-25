const jwt = require("jsonwebtoken");
require("dotenv").config();

// ✅ Middleware xác thực token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  //console.log("🧾 Token received:", authHeader);
  //console.log("🧾 Token received:", req.headers.authorization);
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Không có token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    console.log("✅ Decoded JWT:", req.user); // kiểm tra kết quả thật
    next();
  } catch (err) {
    console.error("❌ Token verify error:", err);
    return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};

// ✅ Middleware phân quyền theo vai trò
const authorizeRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      if (req.headers && req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.redirect('/');
      }
      return res.status(401).json({ message: "Không có quyền truy cập" });
    }

    const userRole = req.user.role;
    if (Array.isArray(roles)) {
      if (!roles.includes(userRole)) {
        if (req.headers && req.headers.accept && req.headers.accept.includes('text/html')) {
          return res.redirect('/');
        }
        return res.status(403).json({ message: "Truy cập bị từ chối" });
      }
    } else {
      if (userRole !== roles) {
        if (req.headers && req.headers.accept && req.headers.accept.includes('text/html')) {
          return res.redirect('/');
        }
        return res.status(403).json({ message: "Truy cập bị từ chối" });
      }
    }

    next();
  };
};

module.exports = { verifyToken, authorizeRole };
