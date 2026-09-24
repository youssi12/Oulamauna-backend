const jwt = require('jsonwebtoken');
const prisma = require("../config/db");

const protect = async (req, res, next) => {
  const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // ✅ Fetch the FRESH user data from the database to check for live bans
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
      select: { 
        id: true, email: true, username: true, role_id: true,
        is_banned: true, allowed_to_contribute: true,
        roles: { select: { role_name: true } }
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // ✅ Check if they were banned while logged in
    if (user.is_banned) {
      return res.status(403).json({ 
        message: 'Your account has been banned.',
        code: 'ACCOUNT_BANNED' // This is the secret signal
      });
    }

    // ✅ Attach the FRESH user data to req.user
    req.user = user;
    next();
    
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}; 

// ✅ ADD THIS NEW MIDDLEWARE AT THE BOTTOM
protect.checkContributionAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (req.user.is_banned) {
    return res.status(403).json({ 
      message: "Your account has been banned.",
      code: "ACCOUNT_BANNED"
    });
  }

  if (req.user.allowed_to_contribute === false) {
    return res.status(403).json({ 
      message: "Your contribution privileges have been revoked by an administrator." 
    });
  }

  next();
};

// ✅ CHANGE THE EXPORT AT THE VERY END TO THIS:
module.exports = protect;