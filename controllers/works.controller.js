const { createWorkService } = require("../service/works.service");
const prisma = require("../config/db");


// ======================================================
// Create Work
// ======================================================
exports.createWork = async (req, res) => {
  const {
    version_id,
    title,
    year,
    format,
    description,
    media_url,
    
  } = req.body;

 console.log("hi working")

  if (!version_id || !title || !format) {
    return res.status(400).json({
      success: false,
      message: "version_id, title and format are required",
    });
  }
  const userId = req.user.id;
  const user = await prisma.users.findUnique({ where: { id: userId } });
   if (!user || !user.allowed_to_contribute) {
       return res.status(403).json({ success: false, message: "You are not allowed to contribute" });
    }

  try {
    const work = await createWorkService({
      version_id,
      title,
      year,
      format,
      description,
      media_url,
      created_by:userId,
      file: req.file,
    });

    res.status(201).json({
      success: true,
      data: work,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// ======================================================
// Approve Work
// ======================================================

 exports.approveWork = async (req, res) => {
  const workId = parseInt(req.params.id);

  try {
    const work = await prisma.scholar_works.findUnique({
      where: {
        work_id: workId,
      },
    });

    if (!work) {
      return res.status(404).json({
        success: false,
        message: "Work not found",
      });
    }

    if (work.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Work is not pending",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {

      // -----------------------------------------
      // If this is a revision, supersede the old
      // work.
      // -----------------------------------------

      if (work.previous_work_id) {
        await tx.scholar_works.update({
          where: {
            work_id: work.previous_work_id,
          },
          data: {
            status: "superseded",
          },
        });
      }

      // -----------------------------------------
      // Approve new revision
      // -----------------------------------------

      return tx.scholar_works.update({
        where: {
          work_id: workId,
        },
        data: {
          status: "approved",
        },
      });
    });

    // -----------------------------------------
    // Notification
    // -----------------------------------------

    if (work.created_by) {
      await prisma.notifications.create({
        data: {
          user_id: work.created_by,
          type: "WORK_APPROVED",
          message: `Your work "${work.title}" has been approved.`,
          related_entity: `work:${workId}`,
          is_read: false,
          created_at: new Date(),
        },
      });
    }

    return res.json({
      success: true,
      message: "Work approved",
      data: updated,
    });

  } catch (error) {
    console.error("approveWork error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ======================================================
// Reject Work
// ======================================================

exports.rejectWork = async (req, res) => {
  const workId = parseInt(req.params.id);
  const { reason } = req.body || {};

  try {
    const work = await prisma.scholar_works.findUnique({
      where: {
        work_id: workId,
      },
    });

    if (!work) {
      return res.status(404).json({
        success: false,
        message: "Work not found",
      });
    }

    if (work.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Work is not pending",
      });
    }

    // -----------------------------------------
    // Only reject the new revision.
    //
    // The previous approved work remains approved.
    // -----------------------------------------

    const updated = await prisma.scholar_works.update({
      where: {
        work_id: workId,
      },
      data: {
        status: "rejected",
      },
    });

    // -----------------------------------------
    // Notification
    // -----------------------------------------

    if (work.created_by) {
      await prisma.notifications.create({
        data: {
          user_id: work.created_by,
          type: "WORK_REJECTED",
          message:
            `Your work "${work.title}" was rejected.` +
            (reason
              ? ` Reason: ${reason}`
              : ""),
          related_entity: `work:${workId}`,
          is_read: false,
          created_at: new Date(),
        },
      });
    }

    return res.json({
      success: true,
      message: "Work rejected",
      data: updated,
    });

  } catch (error) {
    console.error("rejectWork error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// ======================================================
// get pending Work
// ======================================================
exports.getPendingWorks = async (req, res) => {
  try {
    const pending = await prisma.scholar_works.findMany({
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
      },
      orderBy: {
        work_id: "asc",
      },
    });

    res.json({
      success: true,
      data: pending,
    });
  } catch (error) {
    console.error("getPendingWorks error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ===================================================
// Update a work (metadata / external link only — NOT the uploaded file)
// ===================================================
// Editable: title, year, format, description, and media_url — but only
// when the work's source_type is "external". If the work was created via
// an uploaded file (source_type "upload"), media_url edits are rejected
// here; actual file replacement is out of scope for now, same as agreed
// for media/image.

 exports.updateWork = async (req, res) => {
  const workId = parseInt(req.params.id);
  const userId = req.user.id;

  const {
    title,
    year,
    format,
    description,
    media_url,
  } = req.body;

  try {
    // -----------------------------------------
    // 1. Find original work
    // -----------------------------------------

    const work = await prisma.scholar_works.findUnique({
      where: {
        work_id: workId,
      },
    });

    if (!work) {
      return res.status(404).json({
        success: false,
        message: "Work not found",
      });
    }

    // -----------------------------------------
    // 2. Permission
    // -----------------------------------------

    const user = await prisma.users.findUnique({
      where: {
        id: userId,
      },
      include: {
        roles: true,
      },
    });

    const isOwner = work.created_by === userId;
    const isAdmin = user?.roles?.role_name === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to edit this work",
      });
    }

    // -----------------------------------------
    // 3. Only approved works can be edited
    // -----------------------------------------

    if (work.status !== "approved") {
      return res.status(400).json({
        success: false,
        message:
          "Only approved works can be edited. Pending, rejected, or superseded works cannot be edited.",
      });
    }

    // -----------------------------------------
    // 4. Uploaded file cannot have its URL
    //    changed because file replacement isn't
    //    supported yet.
    // -----------------------------------------

    if (
      media_url !== undefined &&
      work.source_type === "upload"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This work was created from an uploaded file — media_url cannot be set. File replacement is not supported yet.",
      });
    }

    // -----------------------------------------
    // 5. Validate format
    // -----------------------------------------

    if (
      format !== undefined &&
      !WORK_FORMATS.has(format)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid format.",
      });
    }

    // -----------------------------------------
    // 6. Create NEW revision
    // -----------------------------------------

    const newWork = await prisma.scholar_works.create({
      data: {
        version_id: work.version_id,

        created_by: userId,

        title:
          title !== undefined
            ? title
            : work.title,

        year:
          year !== undefined
            ? year === null
              ? null
              : parseInt(year)
            : work.year,

        format:
          format !== undefined
            ? format
            : work.format,

        description:
          description !== undefined
            ? description
            : work.description,

        media_url:
          media_url !== undefined
            ? media_url
            : work.media_url,

        file_name: work.file_name,
        file_path: work.file_path,
        source_type: work.source_type,

        status: "pending",

        previous_work_id: work.work_id,
      },
    });

    return res.json({
      success: true,
      message: "Work edit submitted for review",
      data: newWork,
    });

  } catch (error) {
    console.error("updateWork error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};