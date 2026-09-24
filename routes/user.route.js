const express = require("express");
const router = express.Router();

const protect = require("../middlewares/auth.middleware");
const optProtect = require("../middlewares/optionalAuth.middleware");

const { 
  getMyProfile, 
  getUserProfile, 
  updateMyProfile,
  updatePassword, 
  getUserContributions,
  getUserForumPosts 
} = require("../controllers/user.controller");

const { uploadProfilePictureService } = require("../service/profilePicture.service");
const { uploadProfilePicture } = require("../config/cloudinary");  

// ── PUBLIC VIEWING (Optional Auth) ──
// Anyone can view public data, but logged-in users get personalized extras
router.get('/:id/contributions', optProtect, getUserContributions);
router.get('/:id/posts', optProtect, getUserForumPosts);
router.get("/profile/me", protect, getMyProfile);
router.get("/profile/:id", optProtect, getUserProfile);

// ── PRIVATE MANAGEMENT (Required Auth) ──
// Must be logged in to access or modify own account


router.patch(
  "/profile/me",
  protect,
  uploadProfilePicture.single("profile_picture"), // Handle file upload
  updateMyProfile
);

router.put("/profile/update-password", protect, updatePassword);

module.exports = router;