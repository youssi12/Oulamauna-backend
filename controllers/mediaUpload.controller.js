// mediaUpload.controller.js
const { cloudinary } = require("../config/cloudinary");
const prisma = require("../config/db");

 
const uploadMedia = async (req, res) => {
  const { scholar_id } = req.body;
  const userId = req.user.id;
  const file = req.file;

  if (!file) return res.status(400).json({ success: false, message: "No file provided" });
  if (!scholar_id) return res.status(400).json({ success: false, message: "scholar_id is required" });

  try {
    const scholar = await prisma.scholars.findUnique({
      where: { scholar_id: parseInt(scholar_id) },
    });

    if (!scholar) {
      return res.status(404).json({ success: false, message: "Scholar not found" });
    }

    const typeMap = {
      "application/pdf": "pdf",
      "audio/mpeg": "audio",
      "audio/wav": "audio",
      "audio/ogg": "audio",
      "video/mp4": "video",
      "video/webm": "video",
    };

    const file_type = typeMap[file.mimetype] || "pdf";

    const media = await prisma.media.create({
      data: {
        scholar_id: parseInt(scholar_id),
        file_name: file.originalname,
        file_path: file.path,
        file_type,
        status: "pending",
        uploaded_by: userId,
        uploaded_at: new Date(),
        view_count: 0,
        like_count: 0,
      },
    });

    res.status(201).json({ success: true, data: media });
  } catch (error) {
    console.error("uploadMedia error:", error);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
};

// Admin approves media
const approveMedia = async (req, res) => {
  const mediaId = parseInt(req.params.id);

  try {
    const media = await prisma.media.findUnique({ where: { media_id: mediaId } });

    if (!media) {
      return res.status(404).json({ success: false, message: "Media not found" });
    }

    const updated = await prisma.media.update({
      where: { media_id: mediaId },
      data: { status: "approved" },
    });

    // Notify the contributor
    if (media.uploaded_by) {
      await prisma.notifications.create({
        data: {
          user_id: media.uploaded_by,
          type: "MEDIA_APPROVED",
          message: `Your media "${media.file_name}" has been approved.`,
          related_entity: `media:${mediaId}`,
          is_read: false,
          created_at: new Date(),
        },
      });
    }

    res.json({ success: true, message: "Media approved", data: updated });
  } catch (error) {
    console.error("approveMedia error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const rejectMedia = async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const { reason } = req.body;

  try {
    const media = await prisma.media.findUnique({ where: { media_id: mediaId } });

    if (!media) {
      return res.status(404).json({ success: false, message: "Media not found" });
    }

    if (media.status !== "pending") {
      return res.status(400).json({ success: false, message: "Media is not pending" });
    }

    const resourceTypeMap = {
      pdf: "raw",
      audio: "video",
      video: "video",
    };
    const resource_type = resourceTypeMap[media.file_type] || "raw";

    const urlParts = media.file_path.split("/");
    const publicIdWithExt = urlParts.slice(-2).join("/");
    const public_id = publicIdWithExt.replace(/\.[^/.]+$/, "");
    await cloudinary.uploader.destroy(public_id, { resource_type });

    const updated = await prisma.media.update({
      where: { media_id: mediaId },
      data: { status: "rejected" },
    });

    if (media.uploaded_by) {
      await prisma.notifications.create({
        data: {
          user_id: media.uploaded_by,
          type: "MEDIA_REJECTED",
          message: `Your media "${media.file_name}" was rejected.${reason ? ` Reason: ${reason}` : ""}`,
          related_entity: `media:${mediaId}`,
          is_read: false,
          created_at: new Date(),
        },
      });
    }

    res.json({ success: true, message: "Media rejected", data: updated });
  } catch (error) {
    console.error("rejectMedia error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteMedia = async (req, res) => {
  const mediaId = parseInt(req.params.id);

  try {
    const media = await prisma.media.findUnique({ where: { media_id: mediaId } });

    if (!media) {
      return res.status(404).json({ success: false, message: "Media not found" });
    }

    // ✅ ADD THIS
    const resourceTypeMap = {
      pdf: "raw",
      audio: "video",
      video: "video",
    };
    const resource_type = resourceTypeMap[media.file_type] || "raw";

    const urlParts = media.file_path.split("/");
    const publicIdWithExt = urlParts.slice(-2).join("/");
    const public_id = publicIdWithExt.replace(/\.[^/.]+$/, "");

    await cloudinary.uploader.destroy(public_id, { resource_type }); // ✅ was "auto"
    await prisma.media.delete({ where: { media_id: mediaId } });

    res.json({ success: true, message: "Media deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error });
  }
};
 
const getScholarMedia = async (req, res) => {
  const scholarId = parseInt(req.params.scholar_id);

  try {
    const media = await prisma.media.findMany({
      where: {
        scholar_id: scholarId,
        status: "approved",
      },
      orderBy: { uploaded_at: "desc" },
    });

    res.json({ success: true, data: media });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { uploadMedia, approveMedia, deleteMedia, getScholarMedia ,rejectMedia};