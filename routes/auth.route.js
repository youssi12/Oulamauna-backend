const express = require('express');
const router = express.Router();
const {register, login, getme, logout,verifyEmail,resendVerification} = require('../controllers/auth.controller');
const protect = require("../middlewares/auth.middleware");

router.post('/register',register);
router.get('/verify-email',verifyEmail);
router.post('/resend-verification',resendVerification);
router.post('/login',login);
router.get("/me", protect, getme);
router.post("/logout", protect, logout);

module.exports = router;