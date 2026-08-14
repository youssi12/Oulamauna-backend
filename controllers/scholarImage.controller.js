const { uploadScholarImageService,} = require("../service/scholarImage.service");
const prisma = require("../config/db");


// ======================================================
// upload Scholar Image
// ======================================================

 exports.uploadScholarImage = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await prisma.users.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user || !user.allowed_to_contribute) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to contribute",
      });
    }
    

    const { version_id } = req.body;

    const version = await uploadScholarImageService({
      version_id,
      file: req.file,
      uploaded_by: userId,
    });
    console.log("i am testing version",version)

    
    return res.status(201).json({
      success: true,
      data: version,
    });

  } catch (error) {
    console.error("uploadScholarImage error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// ======================================================
// Approve Scholar Image
// ======================================================

 exports.approveScholarImage = async (req, res) => {
  const imageVersionId = parseInt(req.params.id);

  try {
    const imageVersion = await prisma.img_versions.findUnique({
      where: {
        img_version_id: imageVersionId,
      },
      include: {
        scholar_versions: true,
      },
    });

    if (!imageVersion) {
      return res.status(404).json({
        success: false,
        message: "Image version not found",
      });
    }

    if (imageVersion.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Image is not pending",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {

      // Find the currently approved image submission, if one exists
      const currentApproved = await tx.img_versions.findFirst({
        where: {
          version_id: imageVersion.version_id,
          status: "approved",
        },
      });

      // Previous approved image becomes superseded
      if (currentApproved) {
        await tx.img_versions.update({
          where: {
            img_version_id: currentApproved.img_version_id,
          },
          data: {
            status: "superseded",
          },
        });
      }

      // Approve this image
      const approvedImage = await tx.img_versions.update({
        where: {
          img_version_id: imageVersionId,
        },
        data: {
          status: "approved",
        },
      });

      // Update the scalar/current image
      const updatedVersion = await tx.scholar_versions.update({
        where: {
          version_id: imageVersion.version_id,
        },
        data: {
          image_url: imageVersion.image_url,
          image_status: "approved",
          image_uploaded_by: imageVersion.uploaded_by,
        },
      });

      return {
        approvedImage,
        updatedVersion,
      };
    });

    // Notify the actual uploader
    await prisma.notifications.create({
      data: {
        user_id: imageVersion.uploaded_by,
        type: "IMAGE_APPROVED",
        message: `The image for "${imageVersion.scholar_versions.canonical_name}" has been approved.`,
        related_entity: `image_version:${imageVersionId}`,
        is_read: false,
        created_at: new Date(),
      },
    });

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
  const imageVersionId = parseInt(req.params.id);
  const { reason } = req.body || {};

  try {
    const imageVersion = await prisma.img_versions.findUnique({
      where: {
        img_version_id: imageVersionId,
      },
      include: {
        scholar_versions: true,
      },
    });

    if (!imageVersion) {
      return res.status(404).json({
        success: false,
        message: "Image version not found",
      });
    }

    if (imageVersion.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Image is not pending",
      });
    }

    const updated = await prisma.img_versions.update({
      where: {
        img_version_id: imageVersionId,
      },
      data: {
        status: "rejected",
      },
    });

    await prisma.notifications.create({
      data: {
        user_id: imageVersion.uploaded_by,
        type: "IMAGE_REJECTED",
        message: `The image for "${imageVersion.scholar_versions.canonical_name}" was rejected.${reason ? ` Reason: ${reason}` : ""}`,
        related_entity: `image_version:${imageVersionId}`,
        is_read: false,
        created_at: new Date(),
      },
    });

    return res.json({
      success: true,
      message: "Scholar image rejected",
      data: updated,
      reason: reason || null,
    });

  } catch (error) {
    console.error("rejectScholarImage error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ======================================================
//  pending Scholar Image
// ======================================================

exports.getPendingScholarImages = async (req, res) => {
  try {
    const pending = await prisma.img_versions.findMany({
      where: {
        status: "pending",
      },

      include: {
        scholar_versions: {
          include: {
            scholars: true,
            languages: true,
            regions: true,
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
        created_at: "asc",
      },
    });

    return res.json({
      success: true,
      data: pending,
    });

  } catch (error) {
    console.error("getPendingScholarImages error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};