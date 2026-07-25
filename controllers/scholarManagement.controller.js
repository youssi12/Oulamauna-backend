const prisma = require("../config/db");

// exports.getPendingscholars = async (req,res) =>{
//     try {
//         const pending = await prisma.scholar_versions.findMany({
//             where:{status:"pending"},
//             include:{
//                 scholars:true,
//                 users:{select:{
//                     id:true,username:true,email:true
//                 }},
//                 languages:true,
//                 scholar_aliases:true
//             },
//             orderBy:{created_at:"asc"}
//         })


//          res.json({ success: true, data: pending });








//     } catch (error) {
//             console.error("getPendingScholars error:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//     }
// }

exports.getPendingCreatedScholars = async (req, res) => {
    try {
        const pending = await prisma.scholar_versions.findMany({
            where: { status: "pending", version_type: "creation" },
            include: {
                scholars: true,
                users: { select: {
                    id: true, username: true, email: true
                }},
                languages: true,
                scholar_aliases: true,
                scholar_references: true,
            },
            orderBy: { created_at: "asc" }
        })
 
        res.json({ success: true, data: pending });
 
    } catch (error) {
        console.error("getPendingCreatedScholars error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}
 
exports.getPendingEditedScholars = async (req, res) => {
  try {
    const pending = await prisma.scholar_versions.findMany({
      where: { status: "pending", version_type: "edition" },
      include: {
        scholars: true,
        users: { select: { id: true, username: true, email: true } },
        languages: true,
        scholar_aliases: true,
        scholar_references: true, 
      },
      orderBy: { created_at: "asc" }
    });

    // For each pending edit, also fetch the current approved version
    const result = await Promise.all(
      pending.map(async (version) => {
         const currentApproved = await prisma.scholar_versions.findFirst({
              where: {
                scholar_id: version.scholar_id,
                language_id: version.language_id,
                status: "approved",
              },
              include: {
                scholar_aliases: true,
                    scholar_references: true,

              },
              orderBy: {
                created_at: "desc",
              },
            });

        return {
          proposed: version,
          current: currentApproved  // frontend uses this for the left (original) column
        };
      })
    );

    res.json({ success: true, data: result });

  } catch (error) {
    console.error("getPendingEditedScholars error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.approveScholar = async (req, res) => {
  const versionId = parseInt(req.params.id);

  try {
    const version = await prisma.scholar_versions.findUnique({
      where: { version_id: versionId },
    });

    if (!version) {
      return res.status(404).json({
        success: false,
        message: "Version not found",
      });
    }

    if (version.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Version is not pending",
      });
    }

    // 1. Approve version
      const updated = await prisma.scholar_versions.update({
  where: { version_id: versionId },
  data: { status: "approved" },
  include: {
    scholar_aliases: true,
    scholar_references: true,
    languages: true,
    users: {
      select: {
        id: true,
        username: true,
        email: true,
      },
    },
    scholars: true,
  },
});
    // 2. Notify user
    if (version.created_by) {
      await prisma.notifications.create({
        data: {
          user_id: version.created_by,
          type: "SCHOLAR_APPROVED",
          message: `Your scholar submission "${version.canonical_name}" has been approved.`,
          related_entity: `scholar_version:${versionId}`,
          is_read: false,
          created_at: new Date(),
        },
      });
    }

    // 3. Promote user to contributor role (if not already)

    const contributorRole = await prisma.roles.findFirst({
      where: {
        role_name: "contributor",
      },
      select: {
        role_id: true,
      },
    });

    if (contributorRole && version.created_by) {
      await prisma.users.update({
        where: {
          id: version.created_by,
        },
        data: {
          role_id: contributorRole.role_id,
        },
      });
    }

    return res.json({
      success: true,
      message: "Scholar approved",
      data: updated,
    });

  } catch (error) {
    console.error("approveScholar error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.rejectScholar = async (req, res) => {
  const versionId = parseInt(req.params.id);
  const { reason } = req.body;

  try {
    const version = await prisma.scholar_versions.findUnique({
      where: { version_id: versionId },
    });

    if (!version) {
      return res.status(404).json({ success: false, message: "Version not found" });
    }

    if (version.status !== "pending") {
      return res.status(400).json({ success: false, message: "Version is not pending" });
    }

    const updated = await prisma.scholar_versions.update({
      where: { version_id: versionId },
      data: { status: "rejected" },
    });

    // Notify the contributor
    if (version.created_by) {
      await prisma.notifications.create({
        data: {
          user_id: version.created_by,
          type: "SCHOLAR_REJECTED",
          message: `Your scholar submission "${version.canonical_name}" was rejected.${reason ? ` Reason: ${reason}` : ""}`,
          related_entity: `scholar_version:${versionId}`,
          is_read: false,
          created_at: new Date(),
        },
      });
    }

    res.json({ success: true, message: "Scholar rejected", data: updated });
  } catch (error) {
    console.error("rejectScholar error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
;


// get all scholars versions [in a langauge] (this is for admin  )
exports.getScholarVersions = async (req, res) => {
  const scholarId = parseInt(req.params.id);
  const { lang } = req.query; // optional: ?lang=ar or ?lang=en

  try {
    // If lang provided, find the language_id first
    let language = null;
    if (lang) {
      language = await prisma.languages.findFirst({
        where: { code: lang },
      });

      if (!language) {
        return res.status(404).json({ success: false, message: `Language '${lang}' not found` });
      }
    }

    const versions = await prisma.scholar_versions.findMany({
      where: {
        scholar_id: scholarId,
        ...(language ? { language_id: language.language_id } : {}), // filter only if lang given
      },
      include: {
        users: { select: { id: true, username: true } },
        languages: true,
        
      },
      orderBy: { created_at: "desc" },
    });

    res.json({ success: true, count: versions.length, data: versions });
  } catch (error) {
    console.error("getScholarVersions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Toggle contribute permission (admin only)
exports.toggleContributePermission = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.users.findUnique({ where: { id: parseInt(id) } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const updated = await prisma.users.update({
      where: { id: parseInt(id) },
      data: { allowed_to_contribute: !user.allowed_to_contribute }
    });

    res.json({
      success: true,
      message: `User ${updated.allowed_to_contribute ? "can now" : "can no longer"} contribute`,
      allowed_to_contribute: updated.allowed_to_contribute
    });
  } catch (error) {
    console.error("toggleContributePermission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalPending,
      overdue,
      newToday,
      thisWeek
    ] = await Promise.all([
      // Total pending (creation + edition)
      prisma.scholar_versions.count({
        where: { status: "pending" }
      }),

      // Overdue: pending for more than 3 days
      prisma.scholar_versions.count({
        where: {
          status: "pending",
          created_at: { lt: threeDaysAgo }
        }
      }),

      // New today
      prisma.scholar_versions.count({
        where: {
          status: "pending",
          created_at: { gte: startOfToday }
        }
      }),

      // This week: approved/rejected this week (reviewed)
      prisma.scholar_versions.count({
        where: {
          status: { in: ["approved", "rejected"] },
          created_at: { gte: startOfWeek }
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        total_pending: totalPending,
        overdue,
        new_today: newToday,
        this_week: thisWeek
      }
    });

  } catch (error) {
    console.error("getDashboardStats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



// can he delete a scholar

// Keep all approved versions for history.
// Always display only the latest approved version.