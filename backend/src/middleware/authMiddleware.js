const jwt = require("jsonwebtoken");
const { isBlacklisted } = require("../utils/tokenBlacklist");
require("dotenv").config();

// ✅ Middleware xác thực token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Không có token" });
  }

  const token = authHeader.split(" ")[1];

  // ✅ Check if token is blacklisted (logged out)
  if (isBlacklisted(token)) {
    console.log("🚫 [Auth] Blacklisted token used");
    return res.status(401).json({
      message: "Token đã bị vô hiệu hóa. Vui lòng đăng nhập lại.",
      tokenRevoked: true
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    // Store token for potential logout
    req.token = token;
    req.tokenExp = decoded.exp;

    // Log IP mismatch (warning only, not blocking - allows multi-device)
    const clientIp = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'];
    if (decoded.ip && decoded.ip !== clientIp) {
      console.log(`⚠️ [Auth] IP mismatch for user ${decoded.id}: token=${decoded.ip}, current=${clientIp}`);
      // NOT blocking - just logging for security audit
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: "Token đã hết hạn",
        tokenExpired: true
      });
    }
    console.error("❌ Token verify error:", err);
    return res.status(401).json({ message: "Token không hợp lệ" });
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

