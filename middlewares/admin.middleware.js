module.exports = (req, res, next) => {
  console.log(req)
  if (req.user.role_id !== 1)
    return res.status(403).json({ message: "Access denied, admins only" });

  
  next();
};