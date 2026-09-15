const express = require("express");
const router = express.Router();

const protect = require("../middlewares/auth.middleware")
const optProtect = require("../middlewares/optionalAuth.middleware")




const { getMyProfile, getUserProfile, updateMyProfile,getUserContributions,getUserForumPosts } = require("../controllers/user.controller")

const {uploadProfilePictureService} = require("../service/profilePicture.service")

const { uploadProfilePicture } = require("../config/cloudinary");  

 
router.get('/:id/contributions',optProtect,getUserContributions);
router.get('/:id/posts', optProtect, getUserForumPosts);
router.get("/profile/me",protect,getMyProfile);
router.get("/profile/:id",optProtect,getUserProfile);
router.patch(
  "/profile/me",
  protect,
  uploadProfilePicture.single("profile_picture"),
  updateMyProfile
);


 module.exports = router;