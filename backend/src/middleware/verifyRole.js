/**
 * Middleware xác thực quyền truy cập theo role
 * @param {string} role - Role cần kiểm tra
 * @returns {Function} Middleware function
 */
function verifyRole(role) {
  return (req, res, next) => {
    // Kiểm tra xem user đã được xác thực chưa
    if (!req.user) {
      if (req.headers && req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.redirect('/');
      }
      return res.status(401).json({ 
        message: 'Unauthorized - No user information found' 
      });
    }

    // Kiểm tra role
    if (req.user.role !== role) {
      if (req.headers && req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.redirect('/');
      }
      return res.status(403).json({ 
        message: 'Access denied - Insufficient permissions',
        required: role,
        current: req.user.role
      });
    }

    // Cho phép tiếp tục
    next();
  };
}

module.exports = { verifyRole };
