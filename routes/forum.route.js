const express = require("express");
const router = express.Router();

const {
  createPost,
  getPosts,
  getPostById,
  deletePost,
  createComment,
  deleteComment,
  togglePostLike,
  toggleCommentLike,
  reportPost,
  reportComment,
  getCategories,
} = require("../controllers/Forum.controller");

// ✅ 1. Import the middlewares
const protect = require("../middlewares/auth.middleware");
const optionalAuth = require("../middlewares/optionalAuth.middleware");

// ── READ: Anyone can view categories and posts (Guests or Logged-in) ──
router.get("/categories", optionalAuth, getCategories);
router.get("/posts", optionalAuth, getPosts);
router.get("/posts/:id", optionalAuth, getPostById);

// ── ACTIONS: Must be logged in and NOT banned ──
// (Note: We DO NOT use checkContributionAccess here. Revoked users can still use the forum!)
router.post("/posts", protect, createPost);
router.delete("/posts/:id", protect, deletePost); // Controller will check if they are the author

router.post("/posts/:post_id/comments", protect, createComment);
router.delete("/comments/:id", protect, deleteComment); // Controller will check if they are the author

router.post("/posts/:id/like", protect, togglePostLike);
router.post("/comments/:id/like", protect, toggleCommentLike);

router.post("/posts/:id/report", protect, reportPost);
router.post("/comments/:id/report", protect, reportComment);

module.exports = router;