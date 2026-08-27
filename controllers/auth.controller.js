const prisma = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendVerificationEmail, sendResetPasswordEmail } = require("../service/email.service");
require("dotenv").config();

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 24 * 60 * 60 * 1000,
};

exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing)
      return res.status(409).json({ message: "Email already in use" });

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ✅ STEP 1: Find the "user" role (role_id = 3 based on your screenshot)
    const userRole = await prisma.roles.findFirst({
      where: { role_name: "user" }
    });

    if (!userRole) {
      console.error("❌ ERROR: 'user' role not found in database!");
      return res.status(500).json({ message: "System configuration error" });
    }

    // ✅ STEP 2: Create user with ALL required fields
    const user = await prisma.users.create({
      data: { 
        username, 
        email, 
        password_hash: hashedPassword, 
        created_at: new Date(),
        role_id: userRole.role_id,        // 👈 SETS role_id to 3
        allowed_to_contribute: true,      // 👈 SETS to true
        is_banned: false,                 // 👈 SETS to false (0)
        email_verified: false             // 👈 SETS to false
      }
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.email_verifications.create({
      data: { user_id: user.id, token, expires_at: expiresAt }
    });

    await sendVerificationEmail(email, token);
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error(" Registration Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: "Token is required" });

  try {
    const verification = await prisma.email_verifications.findFirst({ where: { token } });
    if (!verification)
      return res.status(400).json({ message: "Invalid token" });

    if (new Date() > new Date(verification.expires_at))
      return res.status(400).json({ message: "Token has expired, please request a new one" });

    await prisma.users.update({
      where: { id: verification.user_id },
      data: { email_verified: true }
    });

    await prisma.email_verifications.delete({ where: { id: verification.id } });

    res.json({ message: "Email verified successfully! You can now log in." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.resendVerification = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.email_verified)
      return res.status(400).json({ message: "Email is already verified" });

    await prisma.email_verifications.deleteMany({ where: { user_id: user.id } });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.email_verifications.create({
      data: { user_id: user.id, token, expires_at: expiresAt }
    });

    await sendVerificationEmail(email, token);
    res.json({ message: "Verification email resent! Please check your inbox." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Please enter all values" });

  try {
    // ✅ UPDATED: Added 'include: { roles: true }' to fetch the role name
    const user = await prisma.users.findUnique({ 
      where: { email },
      include: { roles: true } 
    });
    
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    if (user.is_banned)
      return res.status(403).json({ message: "Your account has been banned" });

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match)
      return res.status(401).json({ message: "Invalid credentials" });

    if (!user.email_verified)
      return res.status(403).json({
        message: "Please verify your email before logging in",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email
      });

    const token = jwt.sign(
      { id: user.id, email: user.email, role_id: user.role_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.cookie("token", token, cookieOptions);
    
    // ✅ UPDATED: Added role_name and allowed_to_contribute to the response
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email,
        role_name: user.roles.role_name, 
        allowed_to_contribute: user.allowed_to_contribute 
      } 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getme = async (req, res) => {
  try {
    // ✅ UPDATED: Changed 'select' to 'include' to get the role_name
    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
      include: { 
        roles: { select: { role_name: true } } 
      }
    });
    
    if (!user) return res.status(404).json({ message: "User not found" });
    
    // ✅ UPDATED: Return the specific fields the frontend needs
    return res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role_name: user.roles.role_name,          
      allowed_to_contribute: user.allowed_to_contribute, 
      is_banned: user.is_banned
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.logout = (req, res) => {
  res.clearCookie("token", cookieOptions);
  res.json({ message: "Logged out successfully" });
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.password_resets.create({
      data: { user_id: user.id, token, expires_at: expiresAt }
    });

    await sendResetPasswordEmail(email, token);
    res.json({ message: "Password reset email sent. Check your inbox." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: "Token required" });

  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ message: "New password required" });

  try {
    const reset = await prisma.password_resets.findUnique({ where: { token } });
    if (!reset) return res.status(400).json({ message: "Invalid token" });
    if (new Date() > new Date(reset.expires_at))
      return res.status(400).json({ message: "Token expired" });

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.users.update({
      where: { id: reset.user_id },
      data: { password_hash: hashedPassword }
    });

    await prisma.password_resets.delete({ where: { token } });
    res.json({ message: "Password has been reset successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};