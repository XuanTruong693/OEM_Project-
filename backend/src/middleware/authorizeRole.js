function authorizeRole(roles = []) {
  // roles: array hoặc string
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Không có quyền truy cập' });
    }
    const userRole = req.user.role;
    if (Array.isArray(roles)) {
      if (!roles.includes(userRole)) {
        return res.status(403).json({ message: 'Truy cập bị từ chối' });
      }
    } else {
      if (userRole !== roles) {
        return res.status(403).json({ message: 'Truy cập bị từ chối' });
      }
    }
    next();
  };
}

module.exports = { authorizeRole };
