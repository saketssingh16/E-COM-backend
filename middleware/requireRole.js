const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user?.role) {
      return res.status(403).json({ message: "Forbidden: role missing." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient privileges." });
    }

    return next();
  };
};

module.exports = requireRole;
