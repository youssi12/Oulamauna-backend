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
      reviewedScholars,
      // ✅ Get ALL pending versions grouped by language (not just creation)
      languageRaw,
      // ✅ Get oldest pending versions (all types)
      urgentRaw
    ] = await Promise.all([
      prisma.scholar_versions.count({
        where: { status: "pending" } // ✅ Removed version_type filter
      }),

      prisma.scholar_versions.count({
        where: {
          status: "pending",
          created_at: { lt: threeDaysAgo } // ✅ Removed version_type filter
        }
      }),

      prisma.scholar_versions.count({
        where: {
          status: "pending",
          created_at: { gte: startOfToday } // ✅ Removed version_type filter
        }
      }),

      prisma.scholar_versions.count({
        where: {
          status: { in: ["approved", "rejected"] },
          created_at: { gte: startOfWeek } // ✅ Removed version_type filter
        }
      }),

      prisma.scholar_versions.findMany({
        where: {
          status: { in: ["approved", "rejected"] },
          created_at: { gte: startOfWeek } // ✅ Removed version_type filter
        },
        select: { created_at: true }
      }),

      // ✅ Group ALL pending versions by language_id
      prisma.scholar_versions.groupBy({
        by: ["language_id"],
        where: { 
          status: "pending", // ✅ Only pending
          language_id: { not: null } 
        },
        _count: { _all: true }
      }),

      // ✅ Get oldest pending versions (all types)
      prisma.scholar_versions.findMany({
        where: { status: "pending" }, // ✅ All pending, not just creation
        orderBy: { created_at: "asc" },
        take: 5,
        select: { 
          version_id: true, 
          canonical_name: true, 
          created_at: true,
          users: { select: { username: true } } // ✅ Include submitter info
        }
      })
    ]);

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

    // Resolve language codes/names from IDs
    const languageIds = languageRaw.map(l => l.language_id).filter(Boolean);
    const languagesMeta = languageIds.length
      ? await prisma.languages.findMany({ 
          where: { language_id: { in: languageIds } },
          select: { language_id: true, code: true, name: true }
        })
      : [];

    const languageBreakdown = languageRaw.map(l => {
      const meta = languagesMeta.find(m => m.language_id === l.language_id);
      return {
        language: meta?.code || meta?.name || "unknown",
        count: l._count._all
      };
    });

    // Format urgent reviews with days waiting
    const urgentReviews = urgentRaw.map(v => ({
      id: v.version_id,
      name: v.canonical_name || `Submission #${v.version_id}`,
      daysWaiting: Math.floor((now - new Date(v.created_at)) / (1000 * 60 * 60 * 24)),
      submittedBy: v.users?.username || "Unknown"
    }));

    res.json({
      success: true,
      data: {
        total_pending: totalPending,
        overdue,
        new_today: newToday,
        this_week: thisWeek,
        avg_review_time: avgReviewTime,
        language_breakdown: languageBreakdown,
        urgent_reviews: urgentReviews
      }
    });

  } catch (error) {
    console.error("getDashboardStats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
exports.getDashboardData = async (req, res) => {
  try {
    // 1. Graph View Toggle: '30days' | 'yearly' | 'all'
    const { graphView } = req.query; 
    const now = new Date();

    // 2. Fetch all basic counts in parallel (100% Safe Prisma)
    const [
      totalUsers, activeContributors, bannedUsers,
      totalScholars, pendingScholars, pendingEdits, pendingMedia, pendingWorks, pendingImages,
      openReports, totalForumPosts, hiddenForumPosts, totalDisciplines
    ] = await Promise.all([
      prisma.users.count(),
      prisma.users.count({ where: { allowed_to_contribute: true, is_banned: false } }),
      prisma.users.count({ where: { is_banned: true } }),
      prisma.scholars.count(),
      prisma.scholar_versions.count({ where: { status: "pending", version_type: "creation" } }),
      prisma.scholar_versions.count({ where: { status: "pending", version_type: "edition" } }),
      prisma.media.count({ where: { status: "pending" } }),
      prisma.scholar_works.count({ where: { status: "pending" } }),
      prisma.img_versions.count({ where: { status: "pending" } }),
      prisma.reports.count({ where: { status: "pending" } }),
      prisma.forum_posts.count({ where: { deleted_at: null } }),
      prisma.forum_posts.count({ where: { is_hidden: true, deleted_at: null } }),
      prisma.disciplines.count()
    ]);

    const totalPending = pendingScholars + pendingEdits + pendingMedia + pendingWorks + pendingImages;

    // 3. Fetch Graph Data (Smart Aggregation based on graphView)
    let formattedGraphData = [];
    
    if (graphView === 'yearly') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const records = await prisma.scholar_versions.findMany({
        where: { status: "approved", created_at: { gte: startOfYear } },
        select: { created_at: true }
      });
      
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthlyData = {};
      monthNames.forEach(m => monthlyData[m] = 0);
      
      records.forEach(item => {
        const monthName = item.created_at.toLocaleDateString('en-US', { month: 'short' });
        if (monthlyData[monthName] !== undefined) monthlyData[monthName]++;
      });
      
      formattedGraphData = Object.keys(monthlyData).map(month => ({ date: month, contributions: monthlyData[month] }));
      
    } else if (graphView === 'all') {
      const allRecords = await prisma.scholar_versions.findMany({
        where: { status: "approved" },
        select: { created_at: true }
      });
      
      const yearlyData = {};
      allRecords.forEach(item => {
        const year = item.created_at.getFullYear().toString();
        yearlyData[year] = (yearlyData[year] || 0) + 1;
      });
      
      formattedGraphData = Object.keys(yearlyData)
        .sort()
        .map(year => ({ date: year, contributions: yearlyData[year] }));
        
    } else {
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      
      const recentApproved = await prisma.scholar_versions.findMany({
        where: { status: "approved", created_at: { gte: thirtyDaysAgo } },
        select: { created_at: true }
      });
      
      const dailyData = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dailyData[dateStr] = 0;
      }
      recentApproved.forEach(item => {
        const dateStr = item.created_at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (dailyData[dateStr] !== undefined) dailyData[dateStr]++;
      });
      formattedGraphData = Object.keys(dailyData).map(date => ({ date, contributions: dailyData[date] }));
    }

    // 4. Fetch Language Distribution (100% DYNAMIC)
    const langDistribution = await prisma.scholar_versions.groupBy({
      by: ['language_id'],
      where: { status: "approved", language_id: { not: null } },
      _count: { language_id: true }
    });

    // ✅ DYNAMIC: Fetch actual language names/codes from the database
    const langIds = langDistribution.map(l => l.language_id).filter(Boolean);
    const languagesMeta = langIds.length 
      ? await prisma.languages.findMany({ 
          where: { language_id: { in: langIds } },
          select: { language_id: true, name: true, code: true }
        })
      : [];

    const formattedLangData = langDistribution.map(l => {
      const meta = languagesMeta.find(m => m.language_id === l.language_id);
      return {
        name: meta?.name || meta?.code || 'Unknown', // ✅ Dynamically gets the real name
        value: l._count.language_id
      };
    });

    // 5. Fetch Urgent Pending Items
    const urgentReviews = await prisma.scholar_versions.findMany({
      where: { status: "pending" },
      select: { 
        version_id: true, canonical_name: true, created_at: true, version_type: true,
        users: { select: { username: true } }
      },
      orderBy: { created_at: 'asc' },
      take: 3
    });

    // 6. Fetch Recent Activity Feed (Scholars, Users, Forum, Reports)
    const [recentScholars, recentUsers, recentForumPosts, recentReports] = await Promise.all([
      prisma.scholar_versions.findMany({ where: { status: "approved" }, select: { canonical_name: true, created_at: true, users: { select: { username: true } } }, orderBy: { created_at: "desc" }, take: 2 }),
      prisma.users.findMany({ select: { username: true, created_at: true }, orderBy: { created_at: "desc" }, take: 2 }),
      prisma.forum_posts.findMany({ where: { deleted_at: null }, select: { title: true, created_at: true, users: { select: { username: true } } }, orderBy: { created_at: "desc" }, take: 2 }),
      prisma.reports.findMany({ where: { status: "pending" }, select: { content_type: true, content_id: true, created_at: true }, orderBy: { created_at: "desc" }, take: 2 })
    ]);

    const activityFeed = [
      ...recentScholars.map(s => ({ type: 'scholar', text: `New Scholar: ${s.canonical_name}`, user: s.users?.username || 'System', date: s.created_at })),
      ...recentUsers.map(u => ({ type: 'user', text: `New User: ${u.username}`, user: u.username, date: u.created_at })),
      ...recentForumPosts.map(p => ({ type: 'forum', text: `New Post: ${p.title}`, user: p.users?.username || 'Anonymous', date: p.created_at })),
      ...recentReports.map(r => ({ type: 'report', text: `New Report on ${r.content_type} #${r.content_id}`, user: 'System', date: r.created_at }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

    // 7. Fetch Top Contributors
    const topContributorsData = await prisma.scholar_versions.groupBy({
      by: ['created_by'], where: { status: "approved", created_by: { not: null } },
      _count: { created_by: true }, orderBy: { _count: { created_by: 'desc' } }, take: 5
    });
    const topUserIds = topContributorsData.map(t => t.created_by).filter(id => id !== null);
    const usersList = topUserIds.length > 0 ? await prisma.users.findMany({ where: { id: { in: topUserIds } }, select: { id: true, username: true } }) : [];
    const finalTopContributors = topContributorsData.map(tc => {
      const user = usersList.find(u => u.id === tc.created_by);
      return { name: user ? user.username : "Unknown User", count: tc._count.created_by };
    });

    // 8. Top Disciplines
    const approvedVersionIds = await prisma.scholar_versions.findMany({ where: { status: "approved" }, select: { version_id: true } });
    const ids = approvedVersionIds.map(v => v.version_id);
    const disciplineLinks = ids.length > 0 ? await prisma.scholar_disciplines.findMany({
      where: { version_id: { in: ids } }, include: { disciplines: true }
    }) : [];
    
    const discCounts = {};
    disciplineLinks.forEach(link => {
      const name = link.disciplines?.name || "Uncategorized";
      discCounts[name] = (discCounts[name] || 0) + 1;
    });
    const topDisciplines = Object.entries(discCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // 9. Pending Age Distribution
    const pendingVersions = await prisma.scholar_versions.findMany({ where: { status: "pending" }, select: { created_at: true } });
    const ageBuckets = { "0-3 days": 0, "4-7 days": 0, "8-14 days": 0, "15+ days": 0 };
    pendingVersions.forEach(v => {
      const days = Math.floor((now - new Date(v.created_at)) / (1000 * 60 * 60 * 24));
      if (days <= 3) ageBuckets["0-3 days"]++;
      else if (days <= 7) ageBuckets["4-7 days"]++;
      else if (days <= 14) ageBuckets["8-14 days"]++;
      else ageBuckets["15+ days"]++;
    });
    const pendingAgeData = Object.keys(ageBuckets).map(key => ({ name: key, value: ageBuckets[key] }));

    // ==========================================
    // ✅ NEW: Forum & Reports Statistical Progress + Urgent Metrics
    // ==========================================

    // 10. Urgent Metrics: High Strike Users (3 or more strikes)
    const highStrikeUsersCount = await prisma.users.count({
      where: { strike_count: { gte: 3 } }
    });

    // 11. Forum Growth (Last 6 Months) - Safe & Fast JS Grouping
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const last6MonthsForumPosts = await prisma.forum_posts.findMany({
      where: { deleted_at: null, created_at: { gte: sixMonthsAgo } },
      select: { created_at: true }
    });

    // Generate exact last 6 months labels to ensure chart always has 6 points
    const last6MonthsLabels = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      last6MonthsLabels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
    }

    const forumGrowthMap = {};
    last6MonthsLabels.forEach(label => forumGrowthMap[label] = 0);
    
    last6MonthsForumPosts.forEach(post => {
      const monthLabel = post.created_at.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (forumGrowthMap[monthLabel] !== undefined) {
        forumGrowthMap[monthLabel]++;
      }
    });
    
    const forumGrowthData = last6MonthsLabels.map(label => ({
      name: label,
      posts: forumGrowthMap[label]
    }));

    // 12. Reports Trend (Last 6 Months) - Safe & Fast JS Grouping
    const last6MonthsReports = await prisma.reports.findMany({
      where: { created_at: { gte: sixMonthsAgo } },
      select: { created_at: true }
    });

    const reportsGrowthMap = {};
    last6MonthsLabels.forEach(label => reportsGrowthMap[label] = 0);

    last6MonthsReports.forEach(report => {
      const monthLabel = report.created_at.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (reportsGrowthMap[monthLabel] !== undefined) {
        reportsGrowthMap[monthLabel]++;
      }
    });

    const reportsGrowthData = last6MonthsLabels.map(label => ({
      name: label,
      reports: reportsGrowthMap[label]
    }));

    // ==========================================
    // SEND RESPONSE
    // ==========================================
    res.json({
      success: true,
      data: {
        summary: { 
          totalUsers, activeContributors, totalScholars, totalPending, openReports,  
          totalForumPosts, hiddenForumPosts, totalDisciplines 
        },
        queueBreakdown: { scholars: pendingScholars, edits: pendingEdits, media: pendingMedia, works: pendingWorks, images: pendingImages },
        dailyContributions: formattedGraphData,
        languageDistribution: formattedLangData,
        urgentReviews: urgentReviews.map(u => ({ 
          id: u.version_id, name: u.canonical_name, type: u.version_type, 
          user: u.users?.username, daysWaiting: Math.floor((now - new Date(u.created_at)) / (1000 * 60 * 60 * 24)) 
        })),
        activityFeed,
        topContributors: finalTopContributors,
        pendingAgeData,
        topDisciplines,
        
        // ✅ NEW: Statistical Progress & Urgent Metrics
        urgentMetrics: {
          pendingReports: openReports,
          highStrikeUsers: highStrikeUsersCount
        },
        forumGrowth: forumGrowthData,
        reportsGrowth: reportsGrowthData
      }
    });

  } catch (error) {
    console.error("getDashboardData error:", error);
    res.status(500).json({ success: false, message: "Server error", details: error.message });
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
const { reason } = req.body || {};
  try {
    const version = await prisma.scholar_versions.findUnique({
      where: { version_id: versionId },
      include: {
        languages: true, // ✅ Added to get the language code for the notification
      },
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
    //⭐ 2. Notify user ONLY if they have notifications enabled
    if (version.created_by) {
      const targetUser = await prisma.users.findUnique({
        where: { id: version.created_by },
        select: { notifications_enabled: true }
      });

      if (targetUser && targetUser.notifications_enabled === true) {
        const langCode = version.languages?.code || 'en'; // ✅ Get the language code
        await prisma.notifications.create({
          data: {
            user_id: version.created_by,
            type: "SCHOLAR_APPROVED",
            message: `Your scholar submission "${version.canonical_name}" has been approved.${reason ? ' Note: ' + reason : ''}`,
            related_entity: `scholar:${version.scholar_id},version:${versionId},lang:${langCode}`, // ✅ UPDATED
            is_read: false,
            created_at: new Date(),
          },
        });
      }
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
            include: {
                languages: true, // ✅ Added to get the language code for the notification
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
// ⭐
        if (version.created_by) {
            const targetUser = await prisma.users.findUnique({
                where: { id: version.created_by },
                select: { notifications_enabled: true }
            });

            if (targetUser && targetUser.notifications_enabled === true) {
                const langCode = version.languages?.code || 'en'; // ✅ Get the language code
                await prisma.notifications.create({
                    data: {
                        user_id: version.created_by,
                        type: "SCHOLAR_REJECTED",
                        message:
                            `Your scholar submission "${version.canonical_name}" was rejected.` +
                            (reason
                                ? ` Reason: ${reason}`
                                : ""),
                        related_entity: `scholar:${version.scholar_id},version:${versionId},lang:${langCode}`, // ✅ UPDATED
                        is_read: false,
                        created_at: new Date(),
                    },
                });
            }
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

// ✅ PERFECTLY SORTED: Get all scholars with versions grouped by Language -> Status -> Time
exports.getAllScholarsSummary = async (req, res) => {
  try {
    const scholars = await prisma.scholars.findMany({
      select: {
        scholar_id: true,
        created_at: true,
        is_featured: true,
        users: { select: { username: true } },
        scholar_versions: {
          select: {
            version_id: true,
            canonical_name: true,
            image_url: true,
            status: true,
            created_at: true, // Needed for time sorting
            languages: { select: { code: true } },
          },
        },
      },
      orderBy: { scholar_id: "desc" },
    });

    const transformed = scholars.map(scholar => {
      const allVersions = scholar.scholar_versions || [];
      
      // Status priority for sorting: Approved (1) > Rejected (2) > Superseded (3) > Pending (4) > Draft (5)
      const statusOrder = { 'approved': 1, 'rejected': 2, 'superseded': 3, 'pending': 4, 'draft': 5 };
      
      // ✅ SORTING LOGIC: Language -> Status -> Time (Newest First)
      const sortedVersions = allVersions.sort((a, b) => {
        // 1. Sort by Language Code (e.g., 'AR' before 'EN')
        const langA = a.languages?.code || 'ZZ';
        const langB = b.languages?.code || 'ZZ';
        if (langA !== langB) {
          return langA.localeCompare(langB);
        }
        
        // 2. Sort by Status Priority
        const statusA = statusOrder[a.status] || 99;
        const statusB = statusOrder[b.status] || 99;
        if (statusA !== statusB) {
          return statusA - statusB;
        }
        
        // 3. Sort by Time (Newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // Calculate counts (including pending for the main badge, even if hidden in modal)
      const approvedCount = sortedVersions.filter(v => v.status === "approved").length;
      const pendingCount = sortedVersions.filter(v => v.status === "pending").length;
      const rejectedCount = sortedVersions.filter(v => v.status === "rejected").length;
      
      // Primary version is always the newest APPROVED one, or fallback to the absolute newest
      const primaryVersion = sortedVersions.find(v => v.status === "approved") || sortedVersions[0];

      return {
        scholarId: scholar.scholar_id.toString(),
        createdBy: scholar.users?.username || "Unknown",
        createdAt: scholar.created_at,
        isFeatured: scholar.is_featured || false,
        status: approvedCount > 0 ? "approved" : (pendingCount > 0 ? "pending" : "rejected"),
        counts: { 
          approved: approvedCount, 
          pending: pendingCount, 
          rejected: rejectedCount, 
          total: sortedVersions.length 
        },
        primaryVersion: primaryVersion ? {
          canonical_name: primaryVersion.canonical_name,
          image_url: primaryVersion.image_url,
          language_code: primaryVersion.languages?.code || "EN"
        } : null,
        // ✅ Return the perfectly sorted array (filtering out pending/draft from the modal list)
        versions: sortedVersions
          .filter(v => v.status !== 'pending' && v.status !== 'draft') // Hide pending/draft from history list
          .map(v => ({
            version_id: v.version_id,
            status: v.status,
            language_code: v.languages?.code || "EN",
            canonical_name: v.canonical_name,
            image_url: v.image_url,
            created_at: v.created_at
          }))
      };
    });

    res.json({ success: true, data: transformed });
  } catch (error) {
    console.error("getAllScholarsSummary error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ FIXED: 'id' is the version_id, so we fetch it directly
exports.getScholarVersionDetail = async (req, res) => {
  const versionId = parseInt(req.params.id, 10); // 'id' is actually version_id!
  const lang = req.params.lang;

  if (Number.isNaN(versionId)) {
    return res.status(400).json({ success: false, message: "Invalid version id" });
  }

  try {
    // ✅ findUnique guarantees we get the EXACT version clicked, no matter its status
    const version = await prisma.scholar_versions.findUnique({
      where: { 
        version_id: versionId 
      },
      include: {
        users: { select: { id: true, username: true } },
        languages: true,
        regions: true,
        scholar_aliases: true,
        scholar_dates: true,
        scholar_disciplines: { include: { disciplines: true } },
        scholar_works: true, 
        media: true,         
        scholar_references: true, 
        scholar_relationships_as_source: {
          include: {
            related_scholar_version: { select: { canonical_name: true, scholar_id: true } },
          },
        },
        img_versions: true, 
      },
    });

    if (!version) {
      return res.status(404).json({ success: false, message: "Version not found" });
    }

    res.json({ success: true, data: version });
  } catch (error) {
    console.error("getScholarVersionDetail error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// ✅ Toggle Featured Status for a Scholar (Admin only)
exports.toggleScholarFeature = async (req, res) => {
  const scholarId = parseInt(req.params.id);

  try {
    const scholar = await prisma.scholars.findUnique({
      where: { scholar_id: scholarId }
    });

    if (!scholar) {
      return res.status(404).json({ success: false, message: "Scholar not found" });
    }

    const updated = await prisma.scholars.update({
      where: { scholar_id: scholarId },
      data: { is_featured: !scholar.is_featured }
    });

    res.json({
      success: true,
      message: updated.is_featured ? "Scholar featured successfully" : "Scholar unfeatured",
      is_featured: updated.is_featured
    });
  } catch (error) {
    console.error("toggleScholarFeature error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};