const express = require('express');
const router = express.Router();
const {register, login, getme, logout,verifyEmail,resendVerification,forgotPassword,resetPassword} = require('../controllers/auth.controller');
const protect = require("../middlewares/auth.middleware");
const {loginLimiter,authLimiter} = require("../middlewares/rateLimiter.middleware")

// const { uploadProfilePicture } = require("../config/cloudinary");
// router.post('/register', uploadProfilePicture.single("profile_picture"), register);

router.post('/register', authLimiter, register);
router.get('/verify-email',verifyEmail);
router.post('/resend-verification',authLimiter,resendVerification);
router.post('/login',loginLimiter,login);
router.get("/me", protect, getme);
router.post("/logout", logout);
router.post('/forgot-password',authLimiter,forgotPassword);
router.post("/reset-password",authLimiter,resetPassword);

module.exports = router;