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
    return res.status(400).json({ success: false, message: "title, content and category are required" });
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
      include: {
        users: { select: { id: true, username: true, name: true, profile_picture: true, roles: { select: { role_name: true } } } },
        forum_categories: true,
        _count: { select: { forum_comments: true } }
      },
    });

    // ✅ Notify Admins
    const admins = await prisma.users.findMany({
      where: { 
        roles: { role_name: "admin" }, 
        notifications_enabled: true 
      },
      select: { id: true }
    });

    if (admins.length > 0) {
      await prisma.notifications.createMany({
        data: admins.map(admin => ({
          user_id: admin.id,
          type: "NEW_FORUM_POST",
          message: `New forum post created: "${title}"`,
          // ✅ BACKEND ONLY: Just saves the entity type and ID
          related_entity: `forum_post:${post.post_id}`, 
          is_read: false,
          created_at: new Date(),
        }))
      });
    }

    res.status(201).json({ success: true, data: post });

  } catch (error) {
    console.error("createPost error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── List posts (paginated, not deleted) ──
// ── List posts (paginated, not deleted) ──
exports.getPosts = async (req, res) => {
  const { category_id, page = 1, limit = 20 } = req.query;
  const userId = req.user?.id; // ✅ Get current user ID

  try {
    // ✅ ADDED: is_hidden: false so auto-hidden posts don't show to the public
    const where = { deleted_at: null, is_hidden: false }; 
    if (category_id) where.category_id = parseInt(category_id);

        const posts = await prisma.forum_posts.findMany({ 
      where, 
      include: { 
        users: { select: { id: true, username: true, name: true, profile_picture: true, roles: { select: { role_name: true } } } }, 
        forum_categories: true, 
        // ✅ UPDATED: Only count comments that are NOT deleted and NOT hidden
        _count: { 
          select: { 
            forum_comments: {
              where: {
                deleted_at: null,
                is_hidden: false
              }
            } 
          } 
        },
        // ✅ ADD THIS: Check if current user liked the post 
        forum_post_likes: userId ? { 
          where: { user_id: userId }, 
          select: { user_id: true } 
        } : false, 
      }, 
      orderBy: { created_at: "desc" }, 
      skip: (parseInt(page) - 1) * parseInt(limit), 
      take: parseInt(limit), 
    });

    // ✅ Format posts to add a clean 'liked' boolean
    const formattedPosts = posts.map(post => {
      const { forum_post_likes, ...rest } = post;
      return {
        ...rest,
        liked: forum_post_likes && forum_post_likes.length > 0, // true if user liked it
      };
    });

    res.json({ success: true, data: formattedPosts });
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
  const userId = req.user?.id; // ✅ Get current user ID

  try {
    const post = await prisma.forum_posts.findUnique({
      where: { post_id: postId, is_hidden: false }, // ✅ ADDED: is_hidden
      include: {
        users: { select: { id: true, username: true, name: true, profile_picture: true, roles: { select: { role_name: true } } } },
        forum_categories: true,
        // ✅ ADD THIS
        forum_post_likes: userId ? {
          where: { user_id: userId },
          select: { user_id: true }
        } : false,
      },
    });

    if (!post || post.deleted_at) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    // ✅ Format post to include 'liked' boolean
    const { forum_post_likes, ...restPost } = post;
    const formattedPost = {
      ...restPost,
      liked: forum_post_likes && forum_post_likes.length > 0,
    };

    const comments = await prisma.forum_comments.findMany({
      where: { post_id: postId, deleted_at: null, is_hidden: false }, // ✅ ADDED: is_hidden
      include: {
        users: { select: { id: true, username: true, name: true, profile_picture: true, roles: { select: { role_name: true } } } },
        // ✅ ADD THIS for comments too
        forum_comment_likes: userId ? {
          where: { user_id: userId },
          select: { user_id: true }
        } : false,
      },
      orderBy: { created_at: "asc" },
    });

    // ✅ Format comments to include 'liked' boolean
    const formattedComments = comments.map(comment => {
      const { forum_comment_likes, ...restComment } = comment;
      return {
        ...restComment,
        // ✅ FIXED: Use the destructured 'forum_comment_likes' variable, NOT 'restComment.forum_comment_likes'
        liked: forum_comment_likes && forum_comment_likes.length > 0, 
      };
    });

    res.json({ success: true, data: { post: formattedPost, comments: formattedComments } });
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
      if (!parent || parent.post_id !== postId || parent.deleted_at) {
        return res.status(400).json({ success: false, message: "Invalid parent_comment_id" });
      }
    }

    // 1. Create the comment
    const comment = await prisma.forum_comments.create({
      data: {
        post_id: postId,
        user_id: userId,
        parent_comment_id: parent_comment_id ? parseInt(parent_comment_id) : null,
        content,
        created_at: new Date(),
      },
      include: {
        users: { select: { id: true, username: true, name: true, profile_picture: true, roles: { select: { role_name: true } } } }
      },
    });

    const notificationsToCreate = [];
    const relatedEntity = `post:${post.post_id},comment:${comment.comment_id}`;

    if (parent_comment_id) {
      // ==========================================
      // SCENARIO A: It's a reply to a comment
      // ==========================================
      
      // 1. Notify the parent comment's author (unless they are replying to themselves)
      const parentComment = await prisma.forum_comments.findUnique({
        where: { comment_id: parseInt(parent_comment_id) },
        select: { user_id: true }
      });

      if (parentComment && parentComment.user_id !== userId) {
        const parentAuthor = await prisma.users.findUnique({
          where: { id: parentComment.user_id },
          select: { notifications_enabled: true }
        });

        if (parentAuthor?.notifications_enabled) {
          notificationsToCreate.push({
            user_id: parentComment.user_id,
            type: "REPLY_TO_COMMENT",
            message: `Someone replied to your comment on "${post.title}"`,
            related_entity: relatedEntity,
            is_read: false,
            created_at: new Date(),
          });
        }
      }

      // ✅ 2. NEW: Notify the POST author about the new activity (unless they are the ones replying)
      if (post.user_id !== userId) { 
        const postAuthor = await prisma.users.findUnique({
          where: { id: post.user_id },
          select: { notifications_enabled: true }
        });

        if (postAuthor?.notifications_enabled) {
          notificationsToCreate.push({
            user_id: post.user_id,
            type: "COMMENT_ON_POST",
            message: `There is a new reply on your post: "${post.title}"`,
            related_entity: relatedEntity,
            is_read: false,
            created_at: new Date(),
          });
        }
      }

    } else {
      // ==========================================
      // SCENARIO B: It's a top-level comment
      // ==========================================
      
      // Notify the post's author (unless they are commenting on their own post)
      if (post.user_id !== userId) { 
        const postAuthor = await prisma.users.findUnique({
          where: { id: post.user_id },
          select: { notifications_enabled: true }
        });

        if (postAuthor?.notifications_enabled) {
          notificationsToCreate.push({
            user_id: post.user_id,
            type: "COMMENT_ON_POST",
            message: `Someone commented on your post: "${post.title}"`,
            related_entity: relatedEntity,
            is_read: false,
            created_at: new Date(),
          });
        }
      }
    }

    // Create all pending notifications in one go
    if (notificationsToCreate.length > 0) {
      await prisma.notifications.createMany({
        data: notificationsToCreate
      });
    }

    res.status(201).json({ success: true, data: comment });

  } catch (error) {
    console.error("createComment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─ Delete a comment (soft delete — owner or admin) ──
// Soft delete only: a hard delete would orphan any replies nested
// under it. The frontend should render deleted comments as
// "[deleted]" while still showing their replies underneath.
// ─ Delete a comment and ALL its nested replies (soft delete) ──
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

    // Use a transaction to ensure the parent and ALL children are deleted together
    await prisma.$transaction(async (tx) => {
      // 1. Recursive helper to find ALL descendant comment IDs
      const getDescendantIds = async (parentId) => {
        const children = await tx.forum_comments.findMany({
          where: { parent_comment_id: parentId },
          select: { comment_id: true }
        });
        
        let ids = children.map(c => c.comment_id);
        for (const childId of ids) {
          const descendantIds = await getDescendantIds(childId);
          ids = [...ids, ...descendantIds];
        }
        return ids;
      };

      // 2. Get the parent ID + all nested reply IDs
      const descendantIds = await getDescendantIds(commentId);
      const idsToDelete = [commentId, ...descendantIds];

      // 3. Soft delete the parent AND all children in ONE database query
      await tx.forum_comments.updateMany({
        where: {
          comment_id: { in: idsToDelete }
        },
        data: { deleted_at: new Date() }
      });
    });

    res.json({ success: true, message: "Comment and all its replies deleted" });
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
    // ✅ Added 'users' include to get the author's username for the notification
    const post = await prisma.forum_posts.findUnique({ 
      where: { post_id: postId },
      include: { users: { select: { id: true, username: true } } } 
    });
    if (!post || post.deleted_at) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    // 1. Create the report
    await prisma.reports.create({
      data: {
        reporter_id: userId,
        content_type: "forum_post",
        content_id: postId,
        reason: reason || null,
        status: "pending",
        created_at: new Date(),
      },
    });

    // 2. Count pending reports for this specific post
    const reportCount = await prisma.reports.count({
      where: {
        content_type: "forum_post",
        content_id: postId,
        status: "pending",
      },
    });

    // 3. ✅ AUTO-HIDE TRIGGER & URGENT NOTIFICATION
    if (reportCount >= 5 && !post.is_hidden) {
      await prisma.forum_posts.update({
        where: { post_id: postId },
        data: { is_hidden: true },
      });

      // ✅ Notify Admins of Auto-Hide
      const admins = await prisma.users.findMany({
        where: { roles: { role_name: "admin" }, notifications_enabled: true },
        select: { id: true }
      });

      if (admins.length > 0) {
        await prisma.notifications.createMany({
          data: admins.map(admin => ({
            user_id: admin.id,
            type: "REPORT_SUBMITTED", 
            message: `🚨 URGENT: A post by "${post.users?.username || 'Unknown'}" was auto-hidden after 5 reports.`,
            related_entity: `forum_post:${postId}`,
            is_read: false,
            created_at: new Date(),
          }))
        });
      }
    }

    res.status(201).json({ success: true, message: "Report submitted successfully" });
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
    // ✅ Added 'users' include to get the author's username for the notification
    const comment = await prisma.forum_comments.findUnique({ 
      where: { comment_id: commentId },
      include: { users: { select: { id: true, username: true } } } 
    });
    if (!comment || comment.deleted_at) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    // 1. Create the report
    await prisma.reports.create({
      data: {
        reporter_id: userId,
        content_type: "forum_comment",
        content_id: commentId,
        reason: reason || null,
        status: "pending",
        created_at: new Date(),
      },
    });

    // 2. Count pending reports for this specific comment
    const reportCount = await prisma.reports.count({
      where: {
        content_type: "forum_comment",
        content_id: commentId,
        status: "pending",
      },
    });

    // 3. ✅ AUTO-HIDE TRIGGER & URGENT NOTIFICATION
    if (reportCount >= 3 && !comment.is_hidden) {
      await prisma.forum_comments.update({
        where: { comment_id: commentId },
        data: { is_hidden: true },
      });

      // ✅ Notify Admins of Auto-Hide
      const admins = await prisma.users.findMany({
        where: { roles: { role_name: "admin" }, notifications_enabled: true },
        select: { id: true }
      });

      if (admins.length > 0) {
        await prisma.notifications.createMany({
          data: admins.map(admin => ({
            user_id: admin.id,
            type: "REPORT_SUBMITTED",
            message: `🚨 URGENT: A comment by "${comment.users?.username || 'Unknown'}" was auto-hidden after 3 reports.`,
            related_entity: `forum_comment:${commentId}`,
            is_read: false,
            created_at: new Date(),
          }))
        });
      }
    }

    res.status(201).json({ success: true, message: "Report submitted successfully" });
  } catch (error) {
    console.error("reportComment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// ── Get all categories (for the "Create Post" dropdown) ──
// ── Get all categories (for the "Create Post" dropdown) ──
exports.getCategories = async (req, res) => {
  try {
    const categories = await prisma.forum_categories.findMany({
      orderBy: { display_order: "asc" },
      include: {
        _count: {
          select: {
            forum_posts: { where: { deleted_at: null } }
          }
        }
      }
    });

    const formattedCategories = categories.map(cat => {
      let parsed = cat.translations;
      
      // Safely parse the JSON string from the database
      if (typeof parsed === 'string') {
        try { 
          parsed = JSON.parse(parsed); 
        } catch (e) { 
          parsed = {}; 
        }
      }
      
      // If it's not a valid object, default to an empty object
      if (!parsed || typeof parsed !== 'object') {
        parsed = {};
      }

      return {
        ...cat,
        translations: parsed, // ✅ DYNAMIC: Sends the ENTIRE translation object (en, ar, fr, es, etc.)
        post_count: cat._count.forum_posts
      };
    });

    res.json({ success: true, data: formattedCategories });
  } catch (error) {
    console.error("getCategories error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};
// ── Helper: recursively collect all descendant comment ids of a given comment ──
// Accepts a Prisma client so it also works inside a $transaction (tx).
async function getDescendantCommentIds(client, commentId) {
  const children = await client.forum_comments.findMany({
    where: { parent_comment_id: commentId },
    select: { comment_id: true },
  });
  let ids = children.map((c) => c.comment_id);
  for (const child of children) {
    ids = ids.concat(await getDescendantCommentIds(client, child.comment_id));
  }
  return ids;
}

// ── Helper: hard-delete a set of comment ids safely, leaves first ──
// `parent_comment_id` is a self-FK with onDelete: NoAction (no DB cascade),
// so a comment can't be deleted while another comment still points at it.
// We repeatedly delete whichever comments currently have no remaining
// children, until the whole set is gone — this works for any nesting depth.
async function deleteCommentsLeafFirst(tx, commentIds) {
  if (commentIds.length === 0) return;

  await tx.forum_comment_likes.deleteMany({ where: { comment_id: { in: commentIds } } });

  let remaining = await tx.forum_comments.findMany({
    where: { comment_id: { in: commentIds } },
    select: { comment_id: true, parent_comment_id: true },
  });

  while (remaining.length > 0) {
    const leaves = remaining.filter(
      (c) => !remaining.some((other) => other.parent_comment_id === c.comment_id)
    );
    if (leaves.length === 0) break; // safety net against a corrupt/cyclic tree
    const leafIds = leaves.map((l) => l.comment_id);
    await tx.forum_comments.deleteMany({ where: { comment_id: { in: leafIds } } });
    const leafIdSet = new Set(leafIds);
    remaining = remaining.filter((c) => !leafIdSet.has(c.comment_id));
  }
}

// ── Admin: Get all posts (including hidden, with report counts) ──
exports.getAdminPosts = async (req, res) => {
  const { category_id, status = 'all', page = 1, limit = 20, search } = req.query;
  try {
    const where = {};
    if (category_id) where.category_id = parseInt(category_id);
    
    // ✅ UPDATED: "active" means NOT deleted AND NOT auto-hidden
    if (status === 'active') {
      where.deleted_at = null;
      where.is_hidden = false; 
    } 
    // ✅ UPDATED: "hidden" means EITHER soft-deleted OR auto-hidden by reports
    else if (status === 'hidden') {
      where.OR = [
        { deleted_at: { not: null } },
        { is_hidden: true }
      ];
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ];
    }

    const posts = await prisma.forum_posts.findMany({
      where,
      include: {
        users: { select: { id: true, username: true, name: true, profile_picture: true, is_banned: true } },
        forum_categories: { select: { name: true, translations: true } },
        _count: { select: { forum_comments: true } },
      },
      orderBy: { created_at: "desc" },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });

    const postIds = posts.map(p => p.post_id);

    const reportCounts = await prisma.reports.groupBy({
      by: ['content_id'],
      where: {
        content_type: "forum_post",
        content_id: { in: postIds },
        status: "pending"
      },
      _count: { report_id: true }
    });

    const countMap = {};
    reportCounts.forEach(rc => {
      countMap[rc.content_id] = rc._count.report_id;
    });

    const formattedPosts = posts.map(post => ({
      ...post,
      report_count: countMap[post.post_id] || 0,
      comment_count: post._count.forum_comments,
      status: post.deleted_at ? "hidden" : "active"
    }));

    const total = await prisma.forum_posts.count({ where });

    res.json({
      success: true,
      data: formattedPosts,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error("getAdminPosts error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Admin: Hide Post (soft delete — reversible, post still exists) ──
exports.hidePost = async (req, res) => {
  const postId = parseInt(req.params.id);
  try {
    await prisma.forum_posts.update({
      where: { post_id: postId },
      data: { deleted_at: new Date() }
    });
    res.json({ success: true, message: "Post hidden from public" });
  } catch (error) {
    console.error("hidePost error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Admin: Restore a hidden post (undo hidePost) ──
exports.restorePost = async (req, res) => {
  const postId = parseInt(req.params.id);
  try {
    await prisma.forum_posts.update({
      where: { post_id: postId },
      data: { deleted_at: null }
    });
    res.json({ success: true, message: "Post restored" });
  } catch (error) {
    console.error("restorePost error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Admin: Delete Post PERMANENTLY (hard delete — irreversible, gone from DB) ──
// FIX: forum_comments.parent_comment_id has onDelete: NoAction (no DB cascade
// for the self-relation), so letting Prisma cascade-delete comments via
// post_id alone crashes with P2003 whenever a comment has replies. We now
// delete every comment under the post manually, leaves first, THEN the post
// (forum_post_likes still cascades fine on its own FK, but we clear it
// explicitly too for clarity/safety).
exports.deletePostPermanently = async (req, res) => {
  const postId = parseInt(req.params.id);
  try {
    await prisma.$transaction(async (tx) => {
      const comments = await tx.forum_comments.findMany({
        where: { post_id: postId },
        select: { comment_id: true },
      });
      await deleteCommentsLeafFirst(tx, comments.map(c => c.comment_id));

      await tx.forum_post_likes.deleteMany({ where: { post_id: postId } });
      await tx.forum_posts.delete({ where: { post_id: postId } });
    });

    res.json({ success: true, message: "Post and all its comments permanently deleted" });
  } catch (error) {
    console.error("deletePostPermanently error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Admin: Get a single post with ALL its comments + replies (ignores deleted_at so mods see full context) ──
exports.getAdminPostById = async (req, res) => {
  const postId = parseInt(req.params.id);

  try {
    const post = await prisma.forum_posts.findUnique({
      where: { post_id: postId },
      include: {
        users: { select: { id: true, username: true, name: true, profile_picture: true, is_banned: true } },
        forum_categories: { select: { name: true, translations: true } },
      },
    });

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    // Includes hidden comments/replies on purpose — full moderation context.
    const comments = await prisma.forum_comments.findMany({
      where: { post_id: postId },
      include: {
        users: { select: { id: true, username: true, name: true, profile_picture: true, roles: { select: { role_name: true } } } },
      },
      orderBy: { created_at: "asc" },
    });

    const commentIds = comments.map(c => c.comment_id);
    const reportCounts = commentIds.length
      ? await prisma.reports.groupBy({
          by: ['content_id'],
          where: { content_type: "forum_comment", content_id: { in: commentIds }, status: "pending" },
          _count: { report_id: true },
        })
      : [];
    const reportMap = {};
    reportCounts.forEach(rc => { reportMap[rc.content_id] = rc._count.report_id; });

    const formattedComments = comments.map(c => ({
      ...c,
      report_count: reportMap[c.comment_id] || 0,
      // ✅ UPDATED: Mark as hidden if it's deleted OR auto-hidden
      status: (c.deleted_at || c.is_hidden) ? "hidden" : "active", 
    }));

    res.json({ success: true, data: { post, comments: formattedComments } });
  } catch (error) {
    console.error("getAdminPostById error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Admin: Hide a single comment (and every reply under it — soft delete cascade) ──
exports.hideComment = async (req, res) => {
  const commentId = parseInt(req.params.id);
  try {
    const descendantIds = await getDescendantCommentIds(prisma, commentId);
    const idsToHide = [commentId, ...descendantIds];
    await prisma.forum_comments.updateMany({
      where: { comment_id: { in: idsToHide } },
      data: { deleted_at: new Date() },
    });
    res.json({ success: true, message: "Comment (and its replies) hidden" });
  } catch (error) {
    console.error("hideComment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Admin: Restore a hidden comment (does NOT auto-restore replies — restore them explicitly if needed) ──
exports.restoreComment = async (req, res) => {
  const commentId = parseInt(req.params.id);
  try {
    await prisma.forum_comments.update({
      where: { comment_id: commentId },
      data: { deleted_at: null },
    });
    res.json({ success: true, message: "Comment restored" });
  } catch (error) {
    console.error("restoreComment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Admin: Delete a single comment PERMANENTLY (hard delete, cascades to replies + likes) ──
// Same fix as deletePostPermanently: replies must go before their parent.
exports.deleteCommentPermanently = async (req, res) => {
  const commentId = parseInt(req.params.id);
  try {
    await prisma.$transaction(async (tx) => {
      const descendantIds = await getDescendantCommentIds(tx, commentId);
      await deleteCommentsLeafFirst(tx, [commentId, ...descendantIds]);
    });
    res.json({ success: true, message: "Comment and all replies permanently deleted" });
  } catch (error) {
    console.error("deleteCommentPermanently error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// ADMIN: REPORT RESOLUTION
// ============================================================

exports.resolveReport = async (req, res) => {
  const { report_id, action } = req.body; // action: "dismiss" or "delete_and_strike"

  if (!report_id || !action) {
    return res.status(400).json({ success: false, message: "report_id and action are required" });
  }

  try {
    const report = await prisma.reports.findUnique({
      where: { report_id: parseInt(report_id) }
    });

    if (!report || report.status !== "pending") {
      return res.status(404).json({ success: false, message: "Report not found or already resolved" });
    }

    const contentType = report.content_type;
    const contentId = report.content_id;

    await prisma.$transaction(async (tx) => {
      // 1. Mark this specific report as resolved
      await tx.reports.update({
        where: { report_id: parseInt(report_id) },
        data: { status: "resolved" }
      });

      if (action === "dismiss") {
        // ✅ DISMISS: Unhide the content and clear ALL pending reports for this content
        if (contentType === "forum_post") {
          await tx.forum_posts.update({ where: { post_id: contentId }, data: { is_hidden: false } });
        } else if (contentType === "forum_comment") {
          await tx.forum_comments.update({ where: { comment_id: contentId }, data: { is_hidden: false } });
        }
        
        // Clear other pending reports for this same content to reset the counter
        await tx.reports.updateMany({
          where: { content_type: contentType, content_id: contentId, status: "pending" },
          data: { status: "dismissed" }
        });

      } else if (action === "delete_and_strike") {
        // ✅ DELETE & STRIKE: Soft delete the content, unhide it, and strike the author
        
        // A. Find the author to add a strike
        let authorId = null;
        if (contentType === "forum_post") {
          const post = await tx.forum_posts.findUnique({ where: { post_id: contentId }, select: { user_id: true } });
          authorId = post?.user_id;
          await tx.forum_posts.update({ where: { post_id: contentId }, data: { deleted_at: new Date(), is_hidden: false } });
        } else if (contentType === "forum_comment") {
          const comment = await tx.forum_comments.findUnique({ where: { comment_id: contentId }, select: { user_id: true } });
          authorId = comment?.user_id;
          await tx.forum_comments.update({ where: { comment_id: contentId }, data: { deleted_at: new Date(), is_hidden: false } });
        }

        // B. Add +1 strike to the author
        if (authorId) {
          await tx.users.update({
            where: { id: authorId },
            data: { strike_count: { increment: 1 } }
          });
        }

        // C. Clear other pending reports for this same content
        await tx.reports.updateMany({
          where: { content_type: contentType, content_id: contentId, status: "pending" },
          data: { status: "resolved" }
        });
      }
    });

    res.json({ success: true, message: `Report ${action === 'dismiss' ? 'dismissed' : 'resolved with strike'} successfully` });
  } catch (error) {
    console.error("resolveReport error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// ── Admin: Get all pending reports with content details ──
exports.getPendingReports = async (req, res) => {
  try {
    const reports = await prisma.reports.findMany({
      where: { status: "pending" },
      include: {
        users: { select: { id: true, username: true, name: true } }, // The reporter
      },
      orderBy: { created_at: "desc" }
    });

    // Enrich each report with the actual content (post or comment) and its author
    const enrichedReports = await Promise.all(reports.map(async (report) => {
      let content = null;
      let author = null;
      
      if (report.content_type === "forum_post") {
        const post = await prisma.forum_posts.findUnique({
          where: { post_id: report.content_id },
          include: { 
            users: { select: { id: true, username: true, name: true, strike_count: true, is_banned: true } }, 
            forum_categories: { select: { name: true } } 
          }
        });
        content = post;
        author = post?.users;
      } else if (report.content_type === "forum_comment") {
        const comment = await prisma.forum_comments.findUnique({
          where: { comment_id: report.content_id },
          include: { 
            users: { select: { id: true, username: true, name: true, strike_count: true, is_banned: true } } 
          }
        });
        content = comment;
        author = comment?.users;
      }

      return { ...report, content, author };
    }));

    res.json({ success: true, data: enrichedReports });
  } catch (error) {
    console.error("getPendingReports error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// ============================================================
// ADMIN: CATEGORY MANAGEMENT
// ============================================================

// ✅ Helper to force clean, lowercase translation keys DYNAMICALLY
const normalizeTranslations = (translations) => {
  if (!translations) return null;
  let parsed = translations;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch (e) { parsed = {}; }
  }
  if (!parsed || typeof parsed !== 'object') return null;

  // Dynamically convert ALL keys to lowercase, preserving ANY language (en, ar, fr, es, etc.)
  const cleanTranslations = {};
  for (const key in parsed) {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      cleanTranslations[key.toLowerCase()] = parsed[key];
    }
  }
  
  return cleanTranslations;
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await prisma.forum_categories.findMany({
      orderBy: { display_order: "asc" },
      include: {
        _count: {
          select: {
            forum_posts: { where: { deleted_at: null } }
          }
        }
      }
    });

    const formattedCategories = categories.map(cat => {
      let parsed = cat.translations;
      
      // Safely parse the JSON string from the database
      if (typeof parsed === 'string') {
        try { 
          parsed = JSON.parse(parsed); 
        } catch (e) { 
          parsed = {}; 
        }
      }
      
      // If it's not a valid object, default to an empty object
      if (!parsed || typeof parsed !== 'object') {
        parsed = {};
      }

      return {
        ...cat,
        translations: parsed, // ✅ DYNAMIC: Sends the ENTIRE translation object (en, ar, fr, es, etc.)
        post_count: cat._count.forum_posts
      };
    });

    res.json({ success: true, data: formattedCategories });
  } catch (error) {
    console.error("getCategories error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};

exports.createCategory = async (req, res) => {
  console.log("🔍 createCategory body:", req.body);
  const { name, translations, description, display_order } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: "Category name is required" });
  }

  try {
    const category = await prisma.forum_categories.create({
      data: {
        name,
        translations: normalizeTranslations(translations), // ✅ NORMALIZED HERE
        description: description || null,
        display_order: display_order !== undefined ? display_order : 0,
        created_at: new Date()
      }
    });

    console.log("✅ Category created successfully");
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    console.error("❌ createCategory error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};

exports.updateCategory = async (req, res) => {
  console.log("🔍 updateCategory params:", req.params, "body:", req.body);
  const categoryId = parseInt(req.params.id);
  const { name, translations, description, display_order } = req.body;

  if (isNaN(categoryId)) {
    return res.status(400).json({ success: false, message: "Invalid category ID" });
  }

  try {
    const category = await prisma.forum_categories.update({
      where: { category_id: categoryId },
      data: {
        name: name !== undefined ? name : undefined,
        // ✅ NORMALIZED HERE: Completely overwrites old messy JSON with clean JSON
        translations: translations !== undefined ? normalizeTranslations(translations) : undefined,
        description: description !== undefined ? description : undefined,
        display_order: display_order !== undefined ? display_order : undefined
      }
    });

    console.log("✅ Category updated successfully");
    res.json({ success: true, data: category });
  } catch (error) {
    console.error("❌ updateCategory error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  console.log("🔍 deleteCategory params:", req.params);
  const categoryId = parseInt(req.params.id);

  if (isNaN(categoryId)) {
    return res.status(400).json({ success: false, message: "Invalid category ID" });
  }

  try {
    const postCount = await prisma.forum_posts.count({
      where: { category_id: categoryId, deleted_at: null }
    });

    if (postCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete category with ${postCount} posts. Please move or delete posts first.` 
      });
    }

    await prisma.forum_categories.delete({
      where: { category_id: categoryId }
    });

    console.log("✅ Category deleted successfully");
    res.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    console.error("❌ deleteCategory error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};

exports.reorderCategories = async (req, res) => {
  console.log("🔍 reorderCategories body:", req.body);
  let { categoryIds } = req.body;

  if (!Array.isArray(categoryIds)) {
    return res.status(400).json({ success: false, message: "categoryIds must be an array" });
  }

  const validIds = categoryIds.filter(id => {
    const num = Number(id);
    return !isNaN(num) && id !== null && id !== undefined;
  });

  if (validIds.length === 0) {
    return res.status(400).json({ success: false, message: "No valid category IDs provided" });
  }

  try {
    const queries = validIds.map((id, index) =>
      prisma.forum_categories.update({
        where: { category_id: Number(id) },
        data: { display_order: index }
      })
    );

    await prisma.$transaction(queries);

    console.log("✅ Categories reordered successfully");
    res.json({ success: true, message: "Categories reordered successfully" });
  } catch (error) {
    console.error("❌ reorderCategories error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};