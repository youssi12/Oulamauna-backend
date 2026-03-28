const db = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendVerificationEmail } = require("../service/email.service");
require("dotenv").config();


const cookieOptions = {
  httpOnly: true,   // JS can't access it
  secure:process.env.NODE_ENV === "production",     // HTTPS only
  sameSite: "strict",
  maxAge: 24 * 60 * 60 * 1000, // 1 day in ms
};



exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  console.log(username, email, password)
  if (!username || !email || !password)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const [existing] = await db.query(
      `SELECT  id FROM users WHERE email = ?`,
      [email]
    );

    if (existing.length > 0)
      return res.status(409).json({ message: "Email already in use" });

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await db.query(
      `INSERT INTO users (username, email, password_hash, created_at)
       VALUES (?, ?, ?, now())`,
      [username, email, hashedPassword]
    );

      // generate verification token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.query(
      `INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)`,
      [result.insertId, token, expiresAt]
    );
 
    await sendVerificationEmail(email, token);

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.query;

  if (!token)
    return res.status(400).json({ message: "Token is required" });

  try {
    const [rows] = await db.query(
      `SELECT * FROM email_verifications WHERE token = ?`,
      [token]
    );

    if (rows.length === 0)
      return res.status(400).json({ message: "Invalid token" });

    const verification = rows[0];

    
    if (new Date() > new Date(verification.expires_at))
      return res.status(400).json({ message: "Token has expired, please request a new one" });
 
    await db.query(
      `UPDATE users SET email_verified = true WHERE id = ?`,
      [verification.user_id]
    );

     
    await db.query(
      `DELETE FROM email_verifications WHERE token = ?`,
      [token]
    );

    res.json({ message: "Email verified successfully! You can now log in." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.resendVerification = async (req, res) => {
  const { email } = req.body;

  if (!email)
    return res.status(400).json({ message: "Email is required" });

  try {
    const [rows] = await db.query(
      `SELECT id, email_verified FROM users WHERE email = ?`,
      [email]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    if (rows[0].email_verified)
      return res.status(400).json({ message: "Email is already verified" });

    const user = rows[0];

    // delete any existing token
    await db.query(
      `DELETE FROM email_verifications WHERE user_id = ?`,
      [user.id]
    );

    // generate a new token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)`,
      [user.id, token, expiresAt]
    );

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
    const [rows] = await db.query(
      `SELECT * FROM users WHERE email = ?`,
      [email]
    );

    if (rows.length === 0)
      return res.status(401).json({ message: "Invalid credentials" });

    const user = rows[0];

    if (user.is_banned)
       return res.status(403).json({ message: "Your account has been banned" });

    if (!user.email_verified)
       return res.status(403).json({ message: "Please verify your email before logging in" });
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
      res.cookie("token", token, cookieOptions);



    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getme = async (req,res)=>{
    try {
        const [rows]=await db.query(`SELECT id, username, email, role_id, is_banned, created_at FROM users WHERE id = ?`,[req.user.id]);
        if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });
    return res.json(rows[0]);
    } catch (error) {
        
    }
}

exports.logout = (req, res) => {
  res.clearCookie("token", cookieOptions);
  res.json({ message: "Logged out successfully" });
};