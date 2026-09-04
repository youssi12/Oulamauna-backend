const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {

    const token = req.cookies.token;

    // No token = user is simply not logged in
    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        console.log("Decoded JWT:", decoded);

        req.user = decoded;

        next();

    } catch (err) {
        // Token exists but is invalid/expired.
        // For optional auth, we don't block the request.
        req.user = null;
        next();
    }
};