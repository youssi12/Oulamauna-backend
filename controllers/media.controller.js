const { cloudinary } = require("../config/cloudinary");
const prisma = require("../config/db");
const { uploadMediaService } = require("../service/media.service");
const { promoteUserToContributor, isAdminUser } = require("../service/role.service");
// ======================================================
// Upload Media
// ======================================================
// FIX: this used to have its own duplicated create logic instead of
// calling uploadMediaService — meaning the version-status guard added
// to the service (blocking uploads to superseded/pending-edition
// versions) never actually ran for this route. Now there is exactly
// one place that logic lives.

const uploadMedia = async (req, res) => {
  const { version_id, media_url, title, year, description } = req.body;
  const userId = req.user.id;
  const file = req.file;

  if (!version_id) {
    return res.status(400).json({
      success: false,
      message: "version_id is required",
    });
  }

  // ✅ Check if user is allowed to contribute
  const user = await prisma.users.findUnique({ where: { id: userId } });
  if (!user || !user.allowed_to_contribute) {
    return res.status(403).json({ success: false, message: "You are not allowed to contribute" });
  }

  try {
    const media = await uploadMediaService({
      version_id,
      title,
      year,
      description,
      media_url,
      file,
      userId,
    });

    // ✅ ADMIN AUTO-APPROVE MEDIA
    const isUserAdmin = await isAdminUser(userId);
    if (isUserAdmin) {
      await prisma.media.update({
        where: { media_id: media.media_id },
        data: { status: "approved" }
      });
    }

    res.status(201).json({
      success: true,
      data: media,
    });

  } catch (error) {
    console.error("uploadMedia error:", error);

    if (error.message === "Scholar version not found") {
      return res.status(404).json({ success: false, message: error.message });
    }

    res.status(400).json({
      success: false,
      message: error.message || "Upload failed",
    });
  }
};

// ======================================================
// Approve Media
// ======================================================

const approveMedia = async (req, res) => {
  const mediaId = parseInt(req.params.id);

  try {
    const media = await prisma.media.findUnique({
      where: {
        media_id: mediaId,
      },
    });

    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Media not found",
      });
    }

    if (media.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Media is not pending",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {

      // -----------------------------------------
      // If this is an edited revision, supersede
      // the original media.
      // -----------------------------------------

      if (media.previous_media_id) {
        await tx.media.update({
          where: {
            media_id: media.previous_media_id,
          },
          data: {
            status: "superseded",
          },
        });
      }

      // -----------------------------------------
      // Approve the new revision
      // -----------------------------------------

      return tx.media.update({
        where: {
          media_id: mediaId,
        },
        data: {
          status: "approved",
        },
      });
    });

    // -----------------------------------------
    // Notification & Auto-Promotion
    // -----------------------------------------

    if (media.uploaded_by) {
      const mediaName =
        media.title ||
        media.file_name ||
        "media";

      await prisma.notifications.create({
        data: {
          user_id: media.uploaded_by,
          type: "MEDIA_APPROVED",
          message: `Your media "${mediaName}" has been approved.`,
          related_entity: `media:${mediaId}`,
          is_read: false,
          created_at: new Date(),
        },
      });

      // ✅ AUTO-PROMOTE THE CREATOR TO CONTRIBUTOR
      // This checks if they are a basic "user" and upgrades them automatically!
      await promoteUserToContributor(media.uploaded_by);
    }

    return res.json({
      success: true,
      message: "Media approved",
      data: updated,
    });

  } catch (error) {
    console.error("approveMedia error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// ======================================================
// Reject Media
// ======================================================
const rejectMedia = async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const { reason } = req.body;

  try {
    const media = await prisma.media.findUnique({
      where: {
        media_id: mediaId,
      },
    });

    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Media not found",
      });
    }

    if (media.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Media is not pending",
      });
    }

    // -----------------------------------------
    // IMPORTANT:
    //
    // Do NOT destroy the file here.
    //
    // If this is an edited revision, it may point
    // to the same Cloudinary file as the original
    // approved media.
    //
    // File cleanup can be handled separately later.
    // -----------------------------------------

    const updated = await prisma.media.update({
      where: {
        media_id: mediaId,
      },
      data: {
        status: "rejected",
      },
    });

    // -----------------------------------------
    // Notification
    // -----------------------------------------

    if (media.uploaded_by) {
      const mediaName =
        media.title ||
        media.file_name ||
        "media";

      await prisma.notifications.create({
        data: {
          user_id: media.uploaded_by,
          type: "MEDIA_REJECTED",
          message:
            `Your media "${mediaName}" was rejected.` +
            (reason
              ? ` Reason: ${reason}`
              : ""),
          related_entity: `media:${mediaId}`,
          is_read: false,
          created_at: new Date(),
        },
      });
    }

    return res.json({
      success: true,
      message: "Media rejected",
      data: updated,
    });

  } catch (error) {
    console.error("rejectMedia error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
 
// ======================================================
// Delete Media
// ======================================================

// ======================================================
// Delete Media
// ======================================================
const deleteMedia = async (req, res) => {
  const mediaId = parseInt(req.params.id);

  try {
    const media = await prisma.media.findUnique({
      where: {
        media_id: mediaId,
      },
    });

    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Media not found",
      });
    }

    // -----------------------------------------
    // Delete Cloudinary file ONLY if this is
    // an original media record.
    //
    // A revision may share the same file_path
    // with its previous approved media.
    // -----------------------------------------

    if (media.file_path && !media.previous_media_id) {
      const resourceTypeMap = {
        pdf: "raw",
        audio: "video",
        video: "video",
      };

      const resource_type =
        resourceTypeMap[media.file_type] || "raw";

      const urlParts = media.file_path.split("/");
      const publicIdWithExt = urlParts.slice(-2).join("/");
      const public_id = publicIdWithExt.replace(/\.[^/.]+$/, "");

      await cloudinary.uploader.destroy(public_id, {
        resource_type,
      });
    }

    await prisma.media.delete({
      where: {
        media_id: mediaId,
      },
    });

    res.json({
      success: true,
      message: "Media deleted",
    });
  } catch (error) {
    console.error("deleteMedia error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ======================================================
// Get Approved Media for a Version
// ======================================================

const getScholarMedia = async (req, res) => {
  const versionId = parseInt(req.params.version_id);

  try {
    const media = await prisma.media.findMany({
      where: {
        version_id: versionId,
        status: "approved",
      },
      orderBy: {
        uploaded_at: "desc",
      },
    });

    res.json({
      success: true,
      data: media,
    });

  } catch (error) {
    console.error("getScholarMedia error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// ======================================================
// Get pending Media for a Version
// ======================================================

const getPendingMedia = async (req, res) => {
  try {
    const pending = await prisma.media.findMany({
      where: {
        status: "pending",
      },
      include: {
        scholar_versions: {
          include: {
            scholars: true,
            languages: true,
          },
        },
        users: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        uploaded_at: "asc",
      },
    });

    res.json({
      success: true,
      data: pending,
    });
  } catch (error) {
    console.error("getPendingMedia error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// ===================================================
// Update media (metadata / external link only — NOT the uploaded file)
// ===================================================
// Editable: title, year, description, and media_url — but only when the
// media's source_type is "external". If it was created via an uploaded
// file (source_type "upload"), media_url edits are rejected here; actual
// file replacement is out of scope for now.

const updateMedia = async (req, res) => {
  const mediaId = parseInt(req.params.media_id);
  const userId = req.user.id;

  const {
    title,
    year,
    description,
    media_url,
  } = req.body;

  try {
    // -----------------------------------------
    // 1. Get existing media
    // -----------------------------------------

    const media = await prisma.media.findUnique({
      where: {
        media_id: mediaId,
      },
    });

    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Media not found",
      });
    }

    // -----------------------------------------
    // 2. Permission check
    // -----------------------------------------

    const user = await prisma.users.findUnique({
      where: {
        id: userId,
      },
      include: {
        roles: true,
      },
    });

    const isOwner = media.uploaded_by === userId;
    const isAdmin = user?.roles?.role_name === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to edit this media",
      });
    }

    // -----------------------------------------
    // 3. Only approved media can be edited
    // -----------------------------------------

    if (media.status !== "approved") {
      return res.status(400).json({
        success: false,
        message:
          "Only approved media can be edited. Pending, rejected, or superseded media cannot be edited.",
      });
    }

    // -----------------------------------------
    // 4. Uploaded files cannot have their URL
    //    changed because file replacement isn't
    //    supported yet.
    // -----------------------------------------

    if (
      media_url !== undefined &&
      media.source_type === "upload"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This media was created from an uploaded file — media_url cannot be set. File replacement is not supported yet.",
      });
    }

    // -----------------------------------------
    // 5. Create a NEW revision
    // -----------------------------------------

    const newMedia = await prisma.media.create({
      data: {
        version_id: media.version_id,

        file_name: media.file_name,
        file_path: media.file_path,

        media_url:
          media_url !== undefined
            ? media_url
            : media.media_url,

        source_type: media.source_type,
        file_type: media.file_type,

        title:
          title !== undefined
            ? title
            : media.title,

        year:
          year !== undefined
            ? year === null
              ? null
              : parseInt(year)
            : media.year,

        description:
          description !== undefined
            ? description
            : media.description,

        uploaded_by: userId,
        uploaded_at: new Date(),

        view_count: media.view_count,
        like_count: media.like_count,

        status: "pending",

        // IMPORTANT
        previous_media_id: media.media_id,
      },
    });

    // -----------------------------------------
    // 6. Response
    // -----------------------------------------

    return res.json({
      success: true,
      message:
        "Media edit submitted for review",
      data: newMedia,
    });

  } catch (error) {
    console.error("updateMedia error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};




 

// ------------------------------------------------------------
// 1. TOGGLE LIKE — like if not liked, unlike if already liked
// ------------------------------------------------------------
const toggleMediaLike = async (req, res) => {
  const userId = req.user.id; // requires auth
  const mediaId = parseInt(req.params.id, 10);

  if (Number.isNaN(mediaId)) {
    return res.status(400).json({ success: false, message: "Invalid media id" });
  }

  try {
    const media = await prisma.media.findUnique({ where: { media_id: mediaId } });
    if (!media) {
      return res.status(404).json({ success: false, message: "Media not found" });
    }

    const existingLike = await prisma.media_likes.findUnique({
      where: {
        media_id_user_id: { media_id: mediaId, user_id: userId }, // Prisma's compound-unique key name
      },
    });

    if (existingLike) {
      // Already liked → unlike
      const [, updatedMedia] = await prisma.$transaction([
        prisma.media_likes.delete({
          where: { media_id_user_id: { media_id: mediaId, user_id: userId } },
        }),
        prisma.media.update({
          where: { media_id: mediaId },
          data: { like_count: { decrement: 1 } },
        }),
      ]);

      return res.json({
        success: true,
        liked: false,
        like_count: updatedMedia.like_count,
      });
    } else {
      // Not liked yet → like
      const [, updatedMedia] = await prisma.$transaction([
        prisma.media_likes.create({
          data: { media_id: mediaId, user_id: userId, created_at: new Date() },
        }),
        prisma.media.update({
          where: { media_id: mediaId },
          data: { like_count: { increment: 1 } },
        }),
      ]);

      return res.json({
        success: true,
        liked: true,
        like_count: updatedMedia.like_count,
      });
    }
  } catch (error) {
    console.error("toggleMediaLike error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ------------------------------------------------------------
// 2. VIEW COUNT — increment on view, no auth required
// ------------------------------------------------------------
const registerMediaView = async (req, res) => {
  const mediaId = parseInt(req.params.id, 10);

  if (Number.isNaN(mediaId)) {
    return res.status(400).json({ success: false, message: "Invalid media id" });
  }

  try {
    const updatedMedia = await prisma.media.update({
      where: { media_id: mediaId },
      data: { view_count: { increment: 1 } },
      select: { media_id: true, view_count: true },
    });

    res.json({ success: true, view_count: updatedMedia.view_count });
  } catch (error) {
    if (error.code === "P2025") {
      // Prisma's "record not found" error for update
      return res.status(404).json({ success: false, message: "Media not found" });
    }
    console.error("registerMediaView error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


module.exports = {
  uploadMedia,
  approveMedia,
  rejectMedia,
  deleteMedia,
  getPendingMedia,
  getScholarMedia,
  updateMedia,
  toggleMediaLike,
  registerMediaView
  
};