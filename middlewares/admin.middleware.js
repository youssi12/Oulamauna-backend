module.exports = (req, res, next) => {
  // authMiddleware must run before this, so req.user is already set
  if (req.user.role !== 1)
    return res.status(403).json({ message: "Access denied, admins only" });

  next();
};