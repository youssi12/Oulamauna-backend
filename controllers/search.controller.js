const prisma = require("../config/db");

exports.globalSearch = async (req, res) => {
  try {
    const { q, lang = "EN" } = req.query;
    if (!q || q.trim() === "") {
      return res.json({ success: true, data: { scholars: [], works: [], media: [], posts: [] } });
    }

    const searchTerm = q.trim();

    const FALLBACK_LABELS = {
      EN: { scholar: "Scholar", media: "Media" },
      FR: { scholar: "Savant", media: "Média" },
      AR: { scholar: "عالم", media: "وسائط" },
    };
    const fb = FALLBACK_LABELS[lang] || FALLBACK_LABELS.EN;

    const [scholars, works, media, posts] = await Promise.all([
      // 1. SCHOLARS
      prisma.scholar_versions.findMany({
        where: {
          status: "approved",
          scholar_id: { not: null },
          OR: [
            { canonical_name: { contains: searchTerm } },
            { biography: { contains: searchTerm } },
            { scholar_aliases: { some: { alias_name: { contains: searchTerm } } } },
          ],
        },
        include: {
          scholar_disciplines: { take: 1, include: { disciplines: true } },
          regions: true,
          languages: true,
        },
        take: 5,
      }),

      // 2. WORKS — ✅ FIX: now also pulls scholar_id + version_id from the parent scholar_versions,
      // and drops any work whose version has no scholar_id (would be a dead link otherwise)
      prisma.scholar_works.findMany({
        where: {
          status: "approved",
          title: { contains: searchTerm },
          scholar_versions: { scholar_id: { not: null } },
        },
        include: {
          scholar_versions: { select: { scholar_id: true, languages: { select: { code: true } } } },
        },
        take: 5,
      }),

      // 3. MEDIA — same fix as works
      prisma.media.findMany({
        where: {
          status: "approved",
          title: { contains: searchTerm },
          scholar_versions: { scholar_id: { not: null } },
        },
        include: {
          scholar_versions: { select: { scholar_id: true, languages: { select: { code: true } } } },
        },
        take: 5,
      }),

      // 4. FORUM POSTS
      prisma.forum_posts.findMany({
        where: {
          deleted_at: null,
          OR: [
            { title: { contains: searchTerm } },
            { content: { contains: searchTerm } },
          ],
        },
        include: { users: { select: { username: true } } },
        take: 5,
      }),
    ]);

    res.json({
      success: true,
      data: {
        scholars: scholars.map((s) => ({
          type: "scholar",
          scholar_id: s.scholar_id,
          lang: (s.languages?.code || "en").toUpperCase(),
          title: s.canonical_name,
          subtitle: s.scholar_disciplines[0]?.disciplines?.name || s.regions?.name || fb.scholar,
        })),
        works: works.map((w) => ({
          type: "work",
          scholar_id: w.scholar_versions?.scholar_id ?? null, // ✅ needed to build the link
          focus_type: "work",
          focus_id: w.work_id,
          lang: (w.scholar_versions?.languages?.code || "en").toUpperCase(),
          title: w.title,
          subtitle: w.year ? `${w.year} • ${w.format}` : w.format,
        })),
        media: media.map((m) => ({
          type: "media",
          scholar_id: m.scholar_versions?.scholar_id ?? null, // ✅ needed to build the link
          focus_type: "media",
          focus_id: m.media_id,
          lang: (m.scholar_versions?.languages?.code || "en").toUpperCase(),
          title: m.title,
          subtitle: m.file_type || fb.media,
        })),
        posts: posts.map((p) => ({
          type: "post",
          post_id: p.post_id,
          title: p.title,
          subtitle: p.content ? p.content.substring(0, 60) + (p.content.length > 60 ? "..." : "") : "",
        })),
      },
    });
  } catch (error) {
    console.error("[search.controller] globalSearch error:", error);
    res.status(500).json({ success: false, message: "Search failed." });
  }
};