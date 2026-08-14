 const prisma = require("../config/db");

exports.getPendingCreatedScholars = async (req, res) => {
  try {
    const pending = await prisma.scholar_versions.findMany({
      where: {
        status: "pending",
        version_type: "creation",
      },

      include: {
        // Main scholar
        scholars: true,

        // Contributor
        users: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },

        // Language
        languages: true,

        // Region
        regions: true,

        // Scholar data
        scholar_aliases: true,
        scholar_dates: true,

        // References + status
        scholar_references: true,

        // Works + status
        scholar_works: true,

        // Media + status
        media: true,

        // FIX: image proposals for this version weren't included here.
        // A brand-new "creation" version can have its own pending image
        // proposal (uploaded via POST /api/img alongside the initial
        // submission), and the admin reviewing this queue previously had
        // no visibility into it without separately hitting
        // GET /api/admin/img/pending. Added for consistency with how
        // works/media/references are already shown inline here.
        img_versions: true,
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
    console.error("getPendingCreatedScholars error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
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
        scholar_aliases: true,
        regions: true,
        // no scholar_references, media, scholar_works, scholar_dates here —
        // a pending edition genuinely owns none of these yet
        //
        // FIX: img_versions IS relevant here, unlike the four above — an
        // image proposal can be submitted against a version regardless of
        // whether it's approved or a brand-new pending/creation version
        // (see uploadScholarImageService's status guard), but NOT against
        // a pending/edition version. So a pending edition itself never
        // owns image proposals either — leaving this comment instead of
        // adding img_versions here, to match the reasoning already given
        // for the four omitted relations above.
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
            // if the edit gets approved. Previously omitted, so an admin
            // reviewing a pending edit had no visibility into the
            // scholar's current image proposal history here.
            img_versions: true,
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
      // ── If this is an edit, reassign children from the old approved version ──
      // FIX: hoisted `previousApproved` out of this if-block (was
      // previously scoped only inside it) so it's still reachable below,
      // where it's now needed to copy the image scalar cache onto the
      // version being approved.
      let previousApproved = null;

      if (version.version_type === "edition") {
          previousApproved = await tx.scholar_versions.findFirst({
               where: {
                 scholar_id: version.scholar_id,
                 language_id: version.language_id,
                 status: "approved",
               },
               orderBy: {
                 created_at: "desc",
               },
               });

        if (previousApproved) {
          await tx.scholar_dates.updateMany({
            where: { version_id: previousApproved.version_id },
            data: { version_id: versionId },
          });
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

          // FIX: img_versions (the image proposal/history table) was
          // completely missing from this reassignment step. Without this,
          // approving an edit left the old version's entire image
          // proposal history — including whichever proposal is currently
          // approved — still pointing at the now-superseded old
          // version_id, orphaned from the version that's actually live
          // going forward. Reassigning it here mirrors exactly what's
          // already done for scholar_dates/media/scholar_works/
          // scholar_references above — same pattern, same table.
          await tx.img_versions.updateMany({
            where: { version_id: previousApproved.version_id },
            data: { version_id: versionId },
          });

          await tx.scholar_versions.update({
            where: { version_id: previousApproved.version_id },
            data: { status: "superseded" },
          });
        }
      }

      return tx.scholar_versions.update({
        where: { version_id: versionId },
        data: {
          status: "approved",

          // FIX: without this, the version becoming live has a null
          // image_url even when the old version had an approved image —
          // editScholar() deliberately no longer copies image_url/
          // image_status onto the new pending edition at submission time
          // (to avoid copying a value that could go stale before this
          // approval happens), so this is now the one place that copy is
          // allowed to happen — using the freshest data available, read
          // at the moment of approval rather than at submission time.
          // Only applies to editions with a previous approved version;
          // a brand-new "creation" version has no previous image to
          // inherit, and its own image proposals (if any) are handled
          // entirely through approveScholarImage instead.
          ...(version.version_type === "edition" && previousApproved
            ? {
                image_url: previousApproved.image_url,
                image_status: previousApproved.image_status,
                image_uploaded_by: previousApproved.image_uploaded_by,
              }
            : {}),
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
          // FIX: added so the response actually reflects the
          // img_versions rows reassigned above, same as every other
          // reassigned relation already included here.
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

    // 3. Promote user to contributor role (if not already)
    const contributorRole = await prisma.roles.findFirst({
      where: { role_name: "contributor" },
      select: { role_id: true },
    });

    if (contributorRole && version.created_by) {
      await prisma.users.update({
        where: { id: version.created_by },
        data: { role_id: contributorRole.role_id },
      });
    }

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
                    // FIX: removed the old
                    //   image_status: version.image_status === "pending" ? "rejected" : version.image_status
                    // line. Under the img_versions design, scholar_versions.
                    // image_status is only ever written by approveScholarImage
                    // (as a cache of whichever proposal is currently approved)
                    // — uploadScholarImageService never sets it to "pending",
                    // so `version.image_status === "pending"` could never be
                    // true here. This was dead code that silently did
                    // nothing; the actual pending image proposal (if any)
                    // lives in img_versions and is handled in step 2 below.
                },
            });

            // ======================================================
            // 2. Reject pending child submissions
            //
            // IMPORTANT:
            // Only pending children are rejected.
            //
            // Approved children are NEVER touched because they may
            // belong to the currently live/approved content.
            // ======================================================

            await tx.scholar_works.updateMany({
                where: {
                    version_id: versionId,
                    status: "pending",
                },
                data: {
                    status: "rejected",
                },
            });

            await tx.scholar_references.updateMany({
                where: {
                    version_id: versionId,
                    status: "pending",
                },
                data: {
                    status: "rejected",
                },
            });

            await tx.media.updateMany({
                where: {
                    version_id: versionId,
                    status: "pending",
                },
                data: {
                    status: "rejected",
                },
            });

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