const prisma = require("../config/db");

exports.getPendingscholars = async (req,res) =>{
    try {
        const pending = await prisma.scholar_versions.findMany({
            where:{status:"pending"},
            include:{
                scholars:true,
                users:{select:{
                    id:true,username:true,email:true
                }},
                languages:true,
                scholar_aliases:true
            },
            orderBy:{created_at:"asc"}
        })


         res.json({ success: true, data: pending });








    } catch (error) {
            console.error("getPendingScholars error:", error);
    res.status(500).json({ success: false, message: "Server error" });
    }
}

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
        revisions: {
          include: {
            users: { select: { id: true, username: true } },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    res.json({ success: true, count: versions.length, data: versions });
  } catch (error) {
    console.error("getScholarVersions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// can he delete a scholar