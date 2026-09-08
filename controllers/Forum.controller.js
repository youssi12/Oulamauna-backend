const prisma = require("../config/db");

// ============================================================
// POSTS
// ============================================================

// ── Create a post ──
// Per spec: registered users publish immediately, no moderation gate.
exports.createPost = async (req, res) => {
  const userId = req.user.id;
  const { title, content, category_id } = req.body;

    
  if (!title || !content || !category_id) {
    return res.status(400).json({ success: false, message: "title,content and category are required" });
  }

  try {

    if (category_id) {
      const category = await prisma.forum_categories.findUnique({
        where: { category_id: parseInt(category_id) },
      });

     
      if (!category) {
        return res.status(400).json({ success: false, message: "Invalid category_id" });
      }
    }

    const post = await prisma.forum_posts.create({
      data: {
        user_id: userId,
        category_id: category_id ? parseInt(category_id) : null,
        title,
        content,
        created_at: new Date(),
      },
    });

    res.status(201).json({ success: true, data: post });
  } catch (error) {
    console.error("createPost error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── List posts (paginated, not deleted) ──
exports.getPosts = async (req, res) => {
  const { category_id, page = 1, limit = 20 } = req.query;

  try {
    const where = { deleted_at: null };
    if (category_id) where.category_id = parseInt(category_id);

    const posts = await prisma.forum_posts.findMany({
      where,
      include: {
        users: { select: { id: true, username: true, name: true, profile_picture: true } },
        forum_categories: true,
        _count: { select: { forum_comments: true } },
      },
      orderBy: { created_at: "desc" },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });

    res.json({ success: true, data: posts });
  } catch (error) {
    console.error("getPosts error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Get a single post with its comments ──
// Comments are returned as a FLAT list (with parent_comment_id) —
// the frontend builds the nested reply tree from that, simpler on
// the backend than recursively nesting query results.
exports.getPostById = async (req, res) => {
  const postId = parseInt(req.params.id);

  try {
    const post = await prisma.forum_posts.findUnique({
      where: { post_id: postId },
      include: {
        users: { select: { id: true, username: true, name: true, profile_picture: true } },
        forum_categories: true,
      },
    });

    if (!post || post.deleted_at) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const comments = await prisma.forum_comments.findMany({
      where: { post_id: postId, deleted_at: null },
      include: {
        users: { select: { id: true, username: true, name: true, profile_picture: true } },
      },
      orderBy: { created_at: "asc" },
    });

    // increment view-ish behavior can go here later if you want a
    // views_count field on forum_posts — not in current schema

    res.json({ success: true, data: { post, comments } });
  } catch (error) {
    console.error("getPostById error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Delete a post (soft delete — owner or admin) ──
exports.deletePost = async (req, res) => {
  const postId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const post = await prisma.forum_posts.findUnique({ where: { post_id: postId } });
    if (!post || post.deleted_at) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const user = await prisma.users.findUnique({ where: { id: userId }, include: { roles: true } });
  

    const isOwner = post.user_id === userId;
    const isAdmin = user?.roles?.role_name === "admin";

     
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this post" });
    }

    await prisma.forum_posts.update({
      where: { post_id: postId },
      data: { deleted_at: new Date() },
    });

    res.json({ success: true, message: "Post deleted" });
  } catch (error) {
    console.error("deletePost error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// COMMENTS
// ============================================================

// ── Create a comment or reply ──
exports.createComment = async (req, res) => {
  const userId = req.user.id;
  const postId = parseInt(req.params.post_id);
  const { content, parent_comment_id } = req.body;

  if (!content) {
    return res.status(400).json({ success: false, message: "content is required" });
  }

  try {
    const post = await prisma.forum_posts.findUnique({ where: { post_id: postId } });
    if (!post || post.deleted_at) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if (parent_comment_id) {
      const parent = await prisma.forum_comments.findUnique({
        where: { comment_id: parseInt(parent_comment_id) },
      });
      // Parent must exist, belong to the SAME post, and not be deleted —
      // otherwise a reply could end up attached to the wrong thread.
      if (!parent || parent.post_id !== postId || parent.deleted_at) {
        return res.status(400).json({ success: false, message: "Invalid parent_comment_id" });
      }
    }

    const comment = await prisma.forum_comments.create({
      data: {
        post_id: postId,
        user_id: userId,
        parent_comment_id: parent_comment_id ? parseInt(parent_comment_id) : null,
        content,
        created_at: new Date(),
      },
    });

    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    console.error("createComment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Delete a comment (soft delete — owner or admin) ──
// Soft delete only: a hard delete would orphan any replies nested
// under it. The frontend should render deleted comments as
// "[deleted]" while still showing their replies underneath.
exports.deleteComment = async (req, res) => {
  const commentId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const comment = await prisma.forum_comments.findUnique({ where: { comment_id: commentId } });
    if (!comment || comment.deleted_at) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    const user = await prisma.users.findUnique({ where: { id: userId }, include: { roles: true } });
    const isOwner = comment.user_id === userId;
    const isAdmin = user?.roles?.role_name === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this comment" });
    }

    await prisma.forum_comments.update({
      where: { comment_id: commentId },
      data: { deleted_at: new Date() },
    });

    res.json({ success: true, message: "Comment deleted" });
  } catch (error) {
    console.error("deleteComment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// LIKES — same toggle pattern used for media_likes
// ============================================================

exports.togglePostLike = async (req, res) => {
  const postId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const post = await prisma.forum_posts.findUnique({ where: { post_id: postId } });
    if (!post || post.deleted_at) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const existing = await prisma.forum_post_likes.findUnique({
      where: { post_id_user_id: { post_id: postId, user_id: userId } },
    });

    const updated = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.forum_post_likes.delete({ where: { like_id: existing.like_id } });
        return tx.forum_posts.update({
          where: { post_id: postId },
          data: { like_count: { decrement: 1 } },
        });
      } else {
        await tx.forum_post_likes.create({
          data: { post_id: postId, user_id: userId, created_at: new Date() },
        });
        return tx.forum_posts.update({
          where: { post_id: postId },
          data: { like_count: { increment: 1 } },
        });
      }
    });

    res.json({ success: true, liked: !existing, like_count: updated.like_count });
  } catch (error) {
    console.error("togglePostLike error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.toggleCommentLike = async (req, res) => {
  const commentId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const comment = await prisma.forum_comments.findUnique({ where: { comment_id: commentId } });
    if (!comment || comment.deleted_at) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    const existing = await prisma.forum_comment_likes.findUnique({
      where: { comment_id_user_id: { comment_id: commentId, user_id: userId } },
    });

    const updated = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.forum_comment_likes.delete({ where: { like_id: existing.like_id } });
        return tx.forum_comments.update({
          where: { comment_id: commentId },
          data: { like_count: { decrement: 1 } },
        });
      } else {
        await tx.forum_comment_likes.create({
          data: { comment_id: commentId, user_id: userId, created_at: new Date() },
        });
        return tx.forum_comments.update({
          where: { comment_id: commentId },
          data: { like_count: { increment: 1 } },
        });
      }
    });

    res.json({ success: true, liked: !existing, like_count: updated.like_count });
  } catch (error) {
    console.error("toggleCommentLike error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// REPORTS — reuses the existing shared `reports` table
// (content_type: "forum_post" | "forum_comment"), not a
// separate forum_reports table.
// ============================================================

exports.reportPost = async (req, res) => {
  const postId = parseInt(req.params.id);
  const userId = req.user.id;
  const { reason } = req.body;

  try {
    const post = await prisma.forum_posts.findUnique({ where: { post_id: postId } });
    if (!post || post.deleted_at) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const report = await prisma.reports.create({
      data: {
        reporter_id: userId,
        content_type: "forum_post",
        content_id: postId,
        reason: reason || null,
        status: "pending",
        created_at: new Date(),
      },
    });

    res.status(201).json({ success: true, message: "Report submitted", data: report });
  } catch (error) {
    console.error("reportPost error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.reportComment = async (req, res) => {
  const commentId = parseInt(req.params.id);
  const userId = req.user.id;
  const { reason } = req.body;

  try {
    const comment = await prisma.forum_comments.findUnique({ where: { comment_id: commentId } });
    if (!comment || comment.deleted_at) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    const report = await prisma.reports.create({
      data: {
        reporter_id: userId,
        content_type: "forum_comment",
        content_id: commentId,
        reason: reason || null,
        status: "pending",
        created_at: new Date(),
      },
    });

    res.status(201).json({ success: true, message: "Report submitted", data: report });
  } catch (error) {
    console.error("reportComment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};