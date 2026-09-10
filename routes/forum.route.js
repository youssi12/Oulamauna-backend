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

const protect = require("../middlewares/auth.middleware");
router.get("/categories", getCategories);
router.use(protect);

// Posts
router.post("/posts", createPost);
router.get("/posts", getPosts);
router.get("/posts/:id", getPostById);
router.delete("/posts/:id", deletePost);

// Comments (nested under a post for creation, flat for delete/like)
router.post("/posts/:post_id/comments", createComment);
router.delete("/comments/:id", deleteComment);

// Likes
router.post("/posts/:id/like", togglePostLike);
router.post("/comments/:id/like", toggleCommentLike);

// Reports
router.post("/posts/:id/report", reportPost);
router.post("/comments/:id/report", reportComment);

module.exports = router;