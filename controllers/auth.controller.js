const prisma = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendVerificationEmail, sendResetPasswordEmail } = require("../service/email.service");
require("dotenv").config();

const isProd = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  maxAge: 24 * 60 * 60 * 1000,
};

const serializeUser = (user) => ({
   id: user.id,
   username: user.username,
   email: user.email,
   name: user.name,
   bio: user.bio,
   links: user.links,
   profile_picture: user.profile_picture,
   allowed_to_contribute: user.allowed_to_contribute,
   contributorBadge: user.contributorBadge,
   is_banned: user.is_banned,
   role_name: user.roles?.role_name ?? null,
 })




exports.register = async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({
      message: "All fields are required"
    });
  }
  if (password.length < 8) {
  return res.status(400).json({ message: "Password must be at least 8 characters" });
}
if (password.length > 72) {
  return res.status(400).json({ message: "Password must be 72 characters or fewer" });
}

  try {
    console.log("REGISTER HANDLER START:", Date.now());
    // Check username and email in parallel
    const [existingUsername, existingEmail] = await Promise.all([
      prisma.users.findUnique({
        where: { username },
        select: { id: true }
      }),
      prisma.users.findUnique({
        where: { email },
        select: { id: true }
      })
    ]);

    if (existingUsername) {
      return res.status(409).json({
        field: "username",
        message: "Username already in use"
      });
    }

    if (existingEmail) {
      return res.status(409).json({
        field: "email",
        message: "Email already in use"
      });
    }


   const hashedPassword = await bcrypt.hash(password, 12);

    const userRole = await prisma.roles.findFirst({
      where: { role_name: "user" },
      select: { role_id: true }
    });

    if (!userRole) {
      console.error("ERROR: 'user' role not found in database!");

      return res.status(500).json({
        message: "System configuration error"
      });
    }

    const user = await prisma.users.create({
      data: {
        username,
        email,
        password_hash: hashedPassword,
        created_at: new Date(),
        role_id: userRole.role_id,
        allowed_to_contribute: true,
        is_banned: false,
        email_verified: false,
        contributorBadge: false
      }
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.email_verifications.create({
      data: {
        user_id: user.id,
        token,
        expires_at: expiresAt
      }
    });

    sendVerificationEmail(email, token).catch((err) =>
  console.error("Verification email failed:", err.message)
);

    return res.status(201).json({
      message: "User created successfully"
    });

  } catch (error) {
    console.error("Registration Error:", error);

    // Prisma unique constraint error
    if (error?.code === "P2002") {
      const target = error?.meta?.target;

      // Duplicate username
      if (
        target === "username" ||
        (Array.isArray(target) && target.includes("username"))
      ) {
        return res.status(409).json({
          field: "username",
          message: "Username already in use"
        });
      }

      // Duplicate email
      if (
        target === "email" ||
        (Array.isArray(target) && target.includes("email"))
      ) {
        return res.status(409).json({
          field: "email",
          message: "Email already in use"
        });
      }

      return res.status(409).json({
        message: "This information is already in use"
      });
    }

    return res.status(500).json({
      message: "Server error"
    });
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
    if(user){
          if (user.email_verified)
             return res.status(400).json({ message: "Email is already verified" });

         await prisma.email_verifications.deleteMany({ where: { user_id: user.id } });
         const token = crypto.randomBytes(32).toString("hex");
         const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

         await prisma.email_verifications.create({
             data: { user_id: user.id, token, expires_at: expiresAt }
            });

         sendVerificationEmail(email, token).catch((err) =>
  console.error("Verification email failed:", err.message)
);
         }
    
    res.json({ message: "If an account exists for this email,a Verification email is resent! Please check your inbox." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Please enter all values"
    });
  }

  try {
    console.log("LOGIN HANDLER START:", Date.now());
    const startTime = Date.now();
    const timings = {};

    const mark = (name) => {
      timings[name] = Date.now() - startTime;
    };

    // 1. Find user and role
    const user = await prisma.users.findUnique({
      where: { email },
      include: { roles: true }
    });

    mark("userLookup");

    if (!user) {
      mark("total");
      console.log("Login timings:", timings);

      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    // 2. Check whether account is banned
    if (user.is_banned) {
      mark("total");
      console.log("Login timings:", timings);

      return res.status(403).json({
        message: "Your account has been banned",
        code: "ACCOUNT_BANNED"
      });
    }

    // 3. Verify password
    const t0 = Date.now();
    const match = await bcrypt.compare(
      password,
      user.password_hash
    );
    console.log("bcrypt.compare took", Date.now() - t0, "ms");

    mark("passwordCompare");

    if (!match) {
      mark("total");
      console.log("Login timings:", timings);

      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    // 4. Check email verification
    if (!user.email_verified) {
      mark("total");
      console.log("Login timings:", timings);

      return res.status(403).json({
        message: "Please verify your email before logging in",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email
      });
    }

    // 5. Reactivate account if needed
    if (!user.is_active) {
      await prisma.users.update({
        where: { id: user.id },
        data: {
          is_active: true,
          deactivated_at: null
        }
      });

      user.is_active = true;
    }

    mark("accountChecks");

    // 6. Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role_id: user.role_id,
        token_version: user.token_version
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    mark("tokenGeneration");

    // 7. Set cookie and return response
    res.cookie("token", token, cookieOptions);

    const responseUser = serializeUser(user);

    mark("serialization");
    mark("total");

    console.log("Login timings:", timings);

    return res.json({
      token,
      user: responseUser
    });

  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};

exports.getme = (req, res) => {
  return res.json(serializeUser(req.user));
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
     
    if (user){
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.password_resets.create({ data: { user_id: user.id, token, expires_at: expiresAt } });
      sendResetPasswordEmail(email, token).catch((err) =>
  console.error("Reset email failed:", err.message)
);
    }
     
     res.json({ message: "If an account exists for this email, a reset link has been sent." });
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
      data: {
         password_hash: hashedPassword ,
          token_version: { increment: 1 }
        }
      
    });

    await prisma.password_resets.delete({ where: { token } });
    res.json({ message: "Password has been reset successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};






// const { uploadProfilePictureService } = require("../service/profilePicture.service");
// const { link } = require("fs");



// exports.register = async (req, res) => {
//   const { username, email, password, name, bio } = req.body;
//   let { links } = req.body;

//   if (!username || !email || !password)
//     return res.status(400).json({ message: "All fields are required" });

//   if (links !== undefined) {
//     try {
//       links = typeof links === "string" ? JSON.parse(links) : links;
//     } catch {
//       return res.status(400).json({ message: "Links must be valid JSON" });
//     }

//     if (typeof links !== "object" || links === null || Array.isArray(links)) {
//       return res.status(400).json({ message: "Links must be a valid object" });
//     }
//   }

//   try {
//     const existing = await prisma.users.findUnique({ where: { email } });
//     if (existing)
//       return res.status(409).json({ message: "Email already in use" });

//     const salt = await bcrypt.genSalt(12);
//     const hashedPassword = await bcrypt.hash(password, salt);

//     const userRole = await prisma.roles.findFirst({
//       where: { role_name: "user" }
//     });

//     if (!userRole) {
//       console.error("❌ ERROR: 'user' role not found in database!");
//       return res.status(500).json({ message: "System configuration error" });
//     }

//     const user = await prisma.users.create({
//       data: {
//         username,
//         email,
//         password_hash: hashedPassword,
//         created_at: new Date(),
//         role_id: userRole.role_id,
//         allowed_to_contribute: true,
//         is_banned: false,
//         email_verified: false,
//         contributorBadge: false,
//         name: name || null,
//         bio: bio || null,
//         links: links || undefined,
//       },
//       select: {
//         id: true,
//         username: true,
//         email: true,
//         name: true,
//         bio: true,
//         links: true,
//       },
//     });

//     // ── Optional profile picture — wrapped so a picture-upload issue
//     // never fails the whole registration ──
//     let profilePicture = null;
//     if (req.file) {
//       try {
//         const updated = await uploadProfilePictureService({ userId: user.id, file: req.file });
//         profilePicture = updated.profile_picture;
//       } catch (err) {
//         console.error("Signup profile picture upload failed:", err.message);
//       }
//     }

//     const token = crypto.randomBytes(32).toString("hex");
//     const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

//     await prisma.email_verifications.create({
//       data: { user_id: user.id, token, expires_at: expiresAt }
//     });

//     await sendVerificationEmail(email, token);

//     res.status(201).json({
//       message: "User created successfully",
//       user: {
//         ...user,
//         profile_picture: profilePicture,
//       },
//     });
//   } catch (error) {
//     console.error(" Registration Error:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };