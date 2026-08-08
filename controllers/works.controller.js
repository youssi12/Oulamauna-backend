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

    const updated = await prisma.scholar_works.update({
      where: {
        work_id: workId,
      },
      data: {
        status: "approved",
      },
    });

     // Notify the contributor
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

    res.json({
      success: true,
      message: "Work approved",
      data: updated,
    });
  } catch (error) {
    console.error("approveWork error:", error);

    res.status(500).json({
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
  const { reason } = req.body || {} ;

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

    const updated = await prisma.scholar_works.update({
      where: {
        work_id: workId,
      },
      data: {
        status: "rejected",
      },
    });

    // Notify the contributor
if (work.created_by) {
  await prisma.notifications.create({
    data: {
      user_id: work.created_by,
      type: "WORK_REJECTED",
      message: `Your work "${work.title}" was rejected.${reason ? ` Reason: ${reason}` : ""}`,
      related_entity: `work:${workId}`,
      is_read: false,
      created_at: new Date(),
    },
  });
}

    res.json({
      success: true,
      message: "Work rejected",
      data: updated,
    });
  } catch (error) {
    console.error("rejectWork error:", error);

    res.status(500).json({
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