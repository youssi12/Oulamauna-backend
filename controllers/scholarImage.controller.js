const { uploadScholarImageService,} = require("../service/scholarImage.service");
const prisma = require("../config/db");


// ======================================================
// upload Scholar Image
// ======================================================

exports.uploadScholarImage = async (req, res) => {
  try {
    const { version_id } = req.body;

    const version = await uploadScholarImageService({
      version_id,
      file: req.file,
    });

    res.status(200).json({
      success: true,
      data: version,
    });
  } catch (error) {
    console.error("uploadScholarImage error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// Approve Scholar Image
// ======================================================

exports.approveScholarImage = async (req, res) => {
  const versionId = parseInt(req.params.id);

  try {
    const version = await prisma.scholar_versions.findUnique({
      where: {
        version_id: versionId,
      },
    });

    if (!version) {
      return res.status(404).json({
        success: false,
        message: "Scholar version not found",
      });
    }

    if (!version.image_url) {
      return res.status(400).json({
        success: false,
        message: "This scholar version has no image",
      });
    }

    if (version.image_status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Image is not pending",
      });
    }

    const updated = await prisma.scholar_versions.update({
      where: {
        version_id: versionId,
      },
      data: {
        image_status: "approved",
      },
    });

    // Notify the contributor
    if (version.created_by) {
      await prisma.notifications.create({
        data: {
          user_id: version.created_by,
          type: "IMAGE_APPROVED",
          message: `The image for "${version.canonical_name}" has been approved.`,
          related_entity: `scholar_version:${versionId}`,
          is_read: false,
          created_at: new Date(),
        },
      });
    }

    return res.json({
      success: true,
      message: "Scholar image approved",
      data: updated,
    });

  } catch (error) {
    console.error("approveScholarImage error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// ======================================================
// Reject Scholar Image
// ======================================================

exports.rejectScholarImage = async (req, res) => {
  const versionId = parseInt(req.params.id);
  const { reason } = req.body;

  try {
    const version = await prisma.scholar_versions.findUnique({
      where: {
        version_id: versionId,
      },
    });

    if (!version) {
      return res.status(404).json({
        success: false,
        message: "Scholar version not found",
      });
    }

    if (!version.image_url) {
      return res.status(400).json({
        success: false,
        message: "This scholar version has no image",
      });
    }

    if (version.image_status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Image is not pending",
      });
    }

    const updated = await prisma.scholar_versions.update({
      where: {
        version_id: versionId,
      },
      data: {
        image_status: "rejected",
      },
    });

    // Notify the contributor
    if (version.created_by) {
      await prisma.notifications.create({
        data: {
          user_id: version.created_by,
          type: "IMAGE_REJECTED",
          message: `The image for "${version.canonical_name}" was rejected.${reason ? ` Reason: ${reason}` : ""}`,
          related_entity: `scholar_version:${versionId}`,
          is_read: false,
          created_at: new Date(),
        },
      });
    }

    return res.json({
      success: true,
      message: "Scholar image rejected",
      data: updated,
    });

  } catch (error) {
    console.error("rejectScholarImage error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


exports.getPendingScholarImages = async (req, res) => {
  try {
    const pending = await prisma.scholar_versions.findMany({
      where: {
        image_status: "pending",
        image_url: {
          not: null,
        },
      },
      include: {
        scholars: true,
        languages: true,
        regions: true,
        users: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: "asc",
      },
    });

    res.json({
      success: true,
      data: pending,
    });
  } catch (error) {
    console.error("getPendingScholarImages error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};