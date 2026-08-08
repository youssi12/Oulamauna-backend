const { cloudinary } = require("../config/cloudinary");
const prisma = require("../config/db");

// ======================================================
// Upload Media
// ======================================================

const uploadMedia = async (req, res) => {
  const {
    version_id,
    media_url,
    title,
    year,
    description,
  } = req.body;

  const userId = req.user.id;
  const file = req.file;

  if (!version_id) {
    return res.status(400).json({
      success: false,
      message: "version_id is required",
    });
  }

  if (!file && !media_url) {
    return res.status(400).json({
      success: false,
      message: "Provide either a file or a media_url",
    });
  }

  if (file && media_url) {
    return res.status(400).json({
      success: false,
      message: "Upload a file OR provide a media_url, not both",
    });
  }

  try {
    const version = await prisma.scholar_versions.findUnique({
      where: {
        version_id: parseInt(version_id),
      },
    });

    if (!version) {
      return res.status(404).json({
        success: false,
        message: "Scholar version not found",
      });
    }

    let mediaData = {
      version_id: parseInt(version_id),
      title: title || null,
      year: year ? parseInt(year) : null,
      description: description || null,

      status: "pending",
      uploaded_by: userId,
      uploaded_at: new Date(),
      view_count: 0,
      like_count: 0,
    };

    if (file) {
      const typeMap = {
        "application/pdf": "pdf",
        "audio/mpeg": "audio",
        "audio/wav": "audio",
        "audio/ogg": "audio",
        "video/mp4": "video",
        "video/webm": "video",
      };

      mediaData = {
        ...mediaData,
        file_name: file.originalname,
        file_path: file.path,
        file_type: typeMap[file.mimetype] || "pdf",
        source_type: "upload",
      };
    } else {
      let file_type = "video";

      const lower = media_url.toLowerCase();

      if (lower.endsWith(".pdf")) {
        file_type = "pdf";
      } else if (
        lower.endsWith(".mp3") ||
        lower.endsWith(".wav") ||
        lower.endsWith(".ogg")
      ) {
        file_type = "audio";
      }

      mediaData = {
        ...mediaData,
        media_url,
        file_type,
        source_type: "external",
      };
    }

    const media = await prisma.media.create({
      data: mediaData,
    });

    res.status(201).json({
      success: true,
      data: media,
    });

  } catch (error) {
    console.error("uploadMedia error:", error);

    res.status(500).json({
      success: false,
      message: "Upload failed",
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

    const updated = await prisma.media.update({
      where: {
        media_id: mediaId,
      },
      data: {
        status: "approved",
      },
    });

    if (media.uploaded_by) {
      const mediaName = media.title || media.file_name || "media";

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
    }

    res.json({
      success: true,
      message: "Media approved",
      data: updated,
    });

  } catch (error) {
    console.error("approveMedia error:", error);

    res.status(500).json({
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

    if (media.file_path) {
      const resourceTypeMap = {
        pdf: "raw",
        audio: "video",
        video: "video",
      };

      const resource_type = resourceTypeMap[media.file_type] || "raw";

      const urlParts = media.file_path.split("/");
      const publicIdWithExt = urlParts.slice(-2).join("/");
      const public_id = publicIdWithExt.replace(/\.[^/.]+$/, "");

      await cloudinary.uploader.destroy(public_id, {
        resource_type,
      });
    }

    const updated = await prisma.media.update({
      where: {
        media_id: mediaId,
      },
      data: {
        status: "rejected",
      },
    });

    if (media.uploaded_by) {
      const mediaName = media.title || media.file_name || "media";

      await prisma.notifications.create({
        data: {
          user_id: media.uploaded_by,
          type: "MEDIA_REJECTED",
          message: `Your media "${mediaName}" was rejected.${reason ? ` Reason: ${reason}` : ""}`,
          related_entity: `media:${mediaId}`,
          is_read: false,
          created_at: new Date(),
        },
      });
    }

    res.json({
      success: true,
      message: "Media rejected",
      data: updated,
    });

  } catch (error) {
    console.error("rejectMedia error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

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

    if (media.file_path) {
      const resourceTypeMap = {
        pdf: "raw",
        audio: "video",
        video: "video",
      };

      const resource_type = resourceTypeMap[media.file_type] || "raw";

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



module.exports = {
  uploadMedia,
  approveMedia,
  rejectMedia,
  deleteMedia,
   getPendingMedia,
  getScholarMedia,
  
};