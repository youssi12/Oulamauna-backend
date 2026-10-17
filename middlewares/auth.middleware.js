const jwt = require('jsonwebtoken');
const prisma = require("../config/db");

const protect = async (req, res, next) => {
  const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // 1) Check the token itself
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }

  // 2) Load the fresh user from the database
  try {
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
      select: {
        id: true, email: true, username: true, role_id: true,
        is_banned: true, allowed_to_contribute: true,
        token_version: true,
        name: true, bio: true, links: true,
        profile_picture: true, contributorBadge: true,
        roles: { select: { role_name: true } }
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (decoded.token_version !== user.token_version) {
      return res.status(401).json({
        message: 'Session expired, please log in again.',
        code: 'SESSION_INVALIDATED'
      });
    }

    if (user.is_banned) {
      return res.status(403).json({
        message: 'Your account has been banned.',
        code: 'ACCOUNT_BANNED'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("protect: database error:", err.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

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

module.exports = protect;