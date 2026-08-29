 const prisma = require("../config/db");
 const { promoteUserToContributor, demoteAndBanUser } = require("../service/role.service");

exports.getPendingCreatedScholars = async (req, res) => {
  try {
    const pending = await prisma.scholar_versions.findMany({
      where: {
        status: "pending",
        version_type: "creation",
      },
      include: {
        scholars: true,
        users: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        languages: true,
        regions: true,
        scholar_aliases: true,
        scholar_dates: true,
        scholar_references: true,
        scholar_works: true,
        media: true,
        img_versions: true,
        
        // ✅ This is the EXACT syntax that works in your getPublishedScholars function
        scholar_disciplines: {
          include: {
            disciplines: true,
          },
        },
        
        // ✅ ADDED: Relationships so the admin can see them during review
        scholar_relationships_as_source: {
          include: {
            related_scholar_version: {
              include: {
                scholars: true,
                languages: true,
              }
            }
          }
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
    // 👇 THIS IS THE LINE THAT PRINTS THE ACTUAL ERROR WE NEED TO SEE
    console.error("getPendingCreatedScholars error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

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
      thisWeek,
      // ✅ ADD THIS: Fetch reviewed scholars to calculate average time
      reviewedScholars
    ] = await Promise.all([
      // Total pending (creation only)
      prisma.scholar_versions.count({
        where: { status: "pending", version_type: "creation" }
      }),

      // Overdue: pending for more than 3 days
      prisma.scholar_versions.count({
        where: {
          status: "pending",
          version_type: "creation",
          created_at: { lt: threeDaysAgo }
        }
      }),

      // New today
      prisma.scholar_versions.count({
        where: {
          status: "pending",
          version_type: "creation",
          created_at: { gte: startOfToday }
        }
      }),

      // This week: approved/rejected this week
      prisma.scholar_versions.count({
        where: {
          status: { in: ["approved", "rejected"] },
          version_type: "creation",
          created_at: { gte: startOfWeek }
        }
      }),

      // ✅ Fetch recently reviewed scholars to calculate avg time
      prisma.scholar_versions.findMany({
        where: {
          status: { in: ["approved", "rejected"] },
          version_type: "creation",
          created_at: { gte: startOfWeek }
        },
        select: { created_at: true }
      })
    ]);

    // ✅ Calculate average review time dynamically
    let avgReviewTime = "0h 0m";
    if (reviewedScholars.length > 0) {
      const totalHours = reviewedScholars.reduce((sum, scholar) => {
        const createdAt = new Date(scholar.created_at);
        return sum + (now - createdAt) / (1000 * 60 * 60);
      }, 0);
      
      const avgHours = Math.floor(totalHours / reviewedScholars.length);
      const avgMinutes = Math.round(((totalHours / reviewedScholars.length) % 1) * 60);
      avgReviewTime = `${avgHours}h ${avgMinutes}m`;
    }

    res.json({
      success: true,
      data: {
        total_pending: totalPending,
        overdue,
        new_today: newToday,
        this_week: thisWeek,
        avg_review_time: avgReviewTime, // ✅ Send real data to frontend
      }
    });

  } catch (error) {
    console.error("getDashboardStats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.getPendingEditedScholars = async (req, res) => {
  try {
        const pending = await prisma.scholar_versions.findMany({
      where: { status: "pending", version_type: "edition" },
      include: {
        scholars: true,
        users: { select: { id: true, username: true, email: true } },
        languages: true,
        regions: true,
        scholar_aliases: true,
        scholar_dates: true,           // ✅ ADDED: To detect date changes
        scholar_references: true,      // ✅ ADDED: To detect reference changes
        scholar_works: true,           // ✅ ADDED: To detect work changes
        media: true,                   // ✅ ADDED: To detect media changes
        img_versions: true,            // ✅ ADDED: To detect image changes
        scholar_disciplines: {         // ✅ ADDED: To detect discipline changes
          include: {
            disciplines: true,
          },
        },
        scholar_relationships_as_source: { // ✅ ADDED: To detect relationship changes
          include: {
            related_scholar_version: {
              include: {
                scholars: true,
                languages: true,
              }
            }
          }
        },
      },
      orderBy: { created_at: "asc" }
    });

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
            scholar_references: true, // ← real, current references live here
            regions: true,
            scholar_dates: true,      // ← and dates
            media: true,              // ← and media
            scholar_works: true,      // ← and works
                       // FIX: img_versions belongs in this list for the same reason
            // as the others — this is the "current, real, still-live"
            // content the admin should see as "will carry over unchanged"
            img_versions: true,
            
            // ✅ ADD THIS: So admin can see relationships that will carry over
            scholar_relationships_as_source: {
              include: {
                related_scholar_version: {
                  include: {
                    scholars: true,
                    languages: true,
                  }
                }
              }
            },
          },
          orderBy: { created_at: "desc" },
        });
        return {
          proposed: version,
          current: currentApproved
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
      return res.status(404).json({ success: false, message: "Version not found" });
    }

    if (version.status !== "pending") {
      return res.status(400).json({ success: false, message: "Version is not pending" });
    }

             const updated = await prisma.$transaction(async (tx) => {
      let previousApproved = null;

      if (version.version_type === "edition") {
        previousApproved = await tx.scholar_versions.findFirst({
          where: {
            scholar_id: version.scholar_id,
            language_id: version.language_id,
            status: "approved",
          },
          orderBy: { created_at: "desc" },
        });

        if (previousApproved) {
          // ✅ MOVE old works, media, references, relationships, images, AND COMMENTS to the new version.
          
          await tx.media.updateMany({
            where: { version_id: previousApproved.version_id },
            data: { version_id: versionId },
          });
          
          await tx.scholar_works.updateMany({
            where: { version_id: previousApproved.version_id },
            data: { version_id: versionId },
          });
          
          await tx.scholar_references.updateMany({
            where: { version_id: previousApproved.version_id },
            data: { version_id: versionId },
          });
          
          await tx.scholar_relationships.updateMany({
            where: { version_id: previousApproved.version_id },
            data: { version_id: versionId },
          });
          
          await tx.img_versions.updateMany({
            where: { version_id: previousApproved.version_id },
            data: { version_id: versionId },
          });

          // ✅ ADD THIS: Move comments to the new approved version so they aren't lost!
          await tx.comments.updateMany({
            where: { version_id: previousApproved.version_id },
            data: { version_id: versionId },
          });

          await tx.scholar_versions.update({
            where: { version_id: previousApproved.version_id },
            data: { status: "superseded" },
          });
        }
      }

      // ==========================================================
      // ✅ NEW GRANULAR APPROVAL LOGIC (Handles Mixed Scenarios)
      // ==========================================================
      const { 
        reject_images = [], 
        reject_works = [], 
        reject_references = [], 
        reject_media = [] 
      } = req.body || {};

      // --- IMAGES --- (Kept exactly as is)
      if (reject_images.length > 0) {
        await tx.img_versions.updateMany({
          where: { version_id: versionId, img_version_id: { in: reject_images } },
          data: { status: "rejected" },
        });
      }
      await tx.img_versions.updateMany({
        where: { version_id: versionId, status: "pending", img_version_id: { notIn: reject_images } },
        data: { status: "approved" },
      });

      // --- WORKS --- (ONLY run for "creation" so editions keep original status)
      if (version.version_type === "creation") {
        if (reject_works.length > 0) {
          await tx.scholar_works.updateMany({
            where: { version_id: versionId, work_id: { in: reject_works } },
            data: { status: "rejected" },
          });
        }
        await tx.scholar_works.updateMany({
          where: { version_id: versionId, status: "pending", work_id: { notIn: reject_works } },
          data: { status: "approved" },
        });
      }

      // --- REFERENCES --- (Kept exactly as is)
      if (reject_references.length > 0) {
        await tx.scholar_references.updateMany({
          where: { version_id: versionId, reference_id: { in: reject_references } },
          data: { status: "rejected" },
        });
      }
      await tx.scholar_references.updateMany({
        where: { version_id: versionId, status: "pending", reference_id: { notIn: reject_references } },
        data: { status: "approved" },
      });

      // --- MEDIA --- (ONLY run for "creation" so editions keep original status)
      if (version.version_type === "creation") {
        if (reject_media.length > 0) {
          await tx.media.updateMany({
            where: { version_id: versionId, media_id: { in: reject_media } },
            data: { status: "rejected" },
          });
        }
        await tx.media.updateMany({
          where: { version_id: versionId, status: "pending", media_id: { notIn: reject_media } },
          data: { status: "approved" },
        });
      }

      // ✅ Find the newly approved image to sync it to scholar_versions
      const approvedImage = await tx.img_versions.findFirst({
        where: { version_id: versionId, status: "approved" },
        orderBy: { created_at: 'desc' }
      });

      // ── Finally, approve the scholar version itself ──
      return tx.scholar_versions.update({
        where: { version_id: versionId },
        data: {
          status: "approved",
          // ✅ Sync the image URL from img_versions to scholar_versions ONLY upon approval
          image_url: approvedImage ? approvedImage.image_url : null,
          image_status: approvedImage ? "approved" : null,
          image_uploaded_by: approvedImage ? approvedImage.uploaded_by : null,
        },
        include: {
          scholar_aliases: true,
          scholar_references: true,
          languages: true,
          regions: true,
          scholar_dates: true,
          media: true,
          scholar_works: true,
          users: { select: { id: true, username: true, email: true } },
          scholars: true,
          img_versions: true,
        },
      });
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

    // 3. ✅ AUTO-PROMOTE THE CREATOR TO CONTRIBUTOR
    // This single line checks if they are a basic "user" and upgrades them automatically!
    await promoteUserToContributor(version.created_by);

    return res.json({ success: true, message: "Scholar approved", data: updated });
  } catch (error) {
    console.error("approveScholar error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

 
exports.rejectScholar = async (req, res) => {
    const versionId = parseInt(req.params.id);
    const { reason } = req.body || {};

    try {
        const version = await prisma.scholar_versions.findUnique({
            where: {
                version_id: versionId,
            },
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

        const updated = await prisma.$transaction(async (tx) => {

            // ======================================================
            // 1. Reject the scholar version
            // ======================================================

            const rejectedVersion = await tx.scholar_versions.update({
                where: {
                    version_id: versionId,
                },
                data: {
                    status: "rejected",
                    // ✅ CLEAR CACHED IMAGE DATA WHEN REJECTING THE SCHOLAR
                    image_url: null,
                    image_status: null,
                    image_uploaded_by: null,
                },
            });

            // ======================================================
            // 2. Reject pending child submissions
            //
            // IMPORTANT:
            // Only pending children are rejected.
            // Approved children are NEVER touched because they may
            // belong to the currently live/approved content.
            // For editions, works and media keep their original status.
            // ======================================================

            // --- WORKS --- (ONLY run for "creation")
            if (version.version_type === "creation") {
                await tx.scholar_works.updateMany({
                    where: {
                        version_id: versionId,
                        status: "pending",
                    },
                    data: {
                        status: "rejected",
                    },
                });
            }

            await tx.scholar_references.updateMany({
                where: {
                    version_id: versionId,
                    status: "pending",
                },
                data: {
                    status: "rejected",
                },
            });

            // --- MEDIA --- (ONLY run for "creation")
            if (version.version_type === "creation") {
                await tx.media.updateMany({
                    where: {
                        version_id: versionId,
                        status: "pending",
                    },
                    data: {
                        status: "rejected",
                    },
                });
            }

            // FIX: pending image proposals attached to this version were
            // never rejected — an img_versions row in "pending" status is
            // exactly the same kind of "pending child" as a pending work,
            // reference, or media item, and belongs in this same cleanup
            // step. Without this, rejecting a scholar's creation left any
            // image proposal that came with it stuck in "pending" forever,
            // with no reviewable path forward (its parent version is now
            // rejected/dead, so it could never legitimately be approved
            // either — uploadScholarImageService's status guard wouldn't
            // even accept a *new* proposal against this version anymore).
            await tx.img_versions.updateMany({
                where: {
                    version_id: versionId,
                    status: "pending",
                },
                data: {
                    status: "rejected",
                },
            });

            return rejectedVersion;
        });

        // ======================================================
        // 3. Notify contributor
        // ======================================================

        if (version.created_by) {
            await prisma.notifications.create({
                data: {
                    user_id: version.created_by,
                    type: "SCHOLAR_REJECTED",
                    message:
                        `Your scholar submission "${version.canonical_name}" was rejected.` +
                        (reason
                            ? ` Reason: ${reason}`
                            : ""),
                    related_entity: `scholar_version:${versionId}`,
                    is_read: false,
                    created_at: new Date(),
                },
            });
        }

        return res.json({
            success: true,
            message: "Scholar rejected",
            data: updated,
        });

    } catch (error) {
        console.error("rejectScholar error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};
 



//! get all scholars versions [in a langauge] (this is for admin  )
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
        regions: true,        // ← added
        scholar_dates: true,  // ← added
        // FIX: added so this admin history view shows each version's
        // image proposal trail too — consistent with the other includes
        // added above in the pending-queue endpoints.
        img_versions: true,
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

// Ban and Demote User (Admin only)
exports.banUser = async (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    await demoteAndBanUser(userId);
    res.json({ 
      success: true, 
      message: "User has been demoted to basic user, banned, and blocked from contributing." 
    });
  } catch (error) {
    console.error("banUser error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};