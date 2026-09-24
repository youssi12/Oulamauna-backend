const { isAdminUser } = require("../service/role.service");

// ✅ ADMIN ONLY MIDDLEWARE
// Checks if the authenticated user is an admin (using dynamic DB lookup)
module.exports = async (req, res, next) => {
  // 1. Make sure user is authenticated (protect middleware should run first)
  if (!req.user || !req.user.id) {
    return res.status(401).json({ 
      success: false, 
      message: "Authentication required" 
    });
  }

  // 2. Check if user is admin using the dynamic helper
  const isAdmin = await isAdminUser(req.user.id);
  
  if (!isAdmin) {
    return res.status(403).json({ 
      success: false, 
      message: "Access denied. Admin privileges required." 
    });
  }

  // 3. User is admin - proceed
  next();
};