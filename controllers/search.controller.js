const prisma = require("../config/db");

exports.globalSearch = async (req, res) => {
  try {
    const { q } = req.query; // ✅ Removed lang, we search ALL languages
    if (!q || q.trim() === "") {
      return res.json({ success: true, data: { scholars: [], works: [], media: [], posts: [] } });
    }

    const searchTerm = q.trim();

    const [scholars, works, media, posts] = await Promise.all([
      // 1. SCHOLARS (Searches ALL languages)
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

      // 2. WORKS (Searches ALL languages)
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

      // 3. MEDIA (Searches ALL languages)
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
          lang: (s.languages?.code || "en").toUpperCase(), // ✅ Frontend knows which language this is
          title: s.canonical_name,
          subtitle: s.scholar_disciplines[0]?.disciplines?.name || s.regions?.name || "Scholar",
        })),
        works: works.map((w) => ({
          type: "work",
          scholar_id: w.scholar_versions?.scholar_id ?? null,
          focus_type: "work",
          focus_id: w.work_id,
          lang: (w.scholar_versions?.languages?.code || "en").toUpperCase(),
          title: w.title,
          subtitle: w.year ? `${w.year} • ${w.format}` : w.format,
        })),
        media: media.map((m) => ({
          type: "media",
          scholar_id: m.scholar_versions?.scholar_id ?? null,
          focus_type: "media",
          focus_id: m.media_id,
          lang: (m.scholar_versions?.languages?.code || "en").toUpperCase(),
          title: m.title,
          subtitle: m.file_type || "Media",
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


exports.searchScholars = async (req, res) => {
  try {
    const { q, lang } = req.query;
    const searchTerm = q ? String(q).trim() : "";

    const whereConditions = {
      status: "approved",
      scholar_id: { not: null },
    };

    // 🕸️ GOD MODE SEARCH: Checks 8 different places!
    if (searchTerm !== "") {
      whereConditions.OR = [
        { canonical_name: { contains: searchTerm } },
        { scholar_aliases: { some: { alias_name: { contains: searchTerm } } } },
        { biography: { contains: searchTerm } },
        
        // ✅ Type a Region name? (e.g., "Baghdad")
        { regions: { name: { contains: searchTerm } } },
        
        // ✅ Type a Discipline name? (e.g., "Medicine", "Fiqh")
        { scholar_disciplines: { some: { disciplines: { name: { contains: searchTerm } } } } },
        
        // ✅ Type a Book/Work title? (e.g., "Canon")
        { scholar_works: { some: { title: { contains: searchTerm } } } },
        
        // ✅ Type a Media title? (e.g., "Manuscript scan", "Portrait")
        { media: { some: { title: { contains: searchTerm } } } },
        
        // ✅ Type words from Media description? (e.g., "rare", "first edition")
        { media: { some: { description: { contains: searchTerm } } } }
      ];
    }

    // 2. Language Filter (Resolve language_id first to be 100% safe)
    if (lang) {
      const language = await prisma.languages.findFirst({
        where: { code: String(lang).toLowerCase() }
      });
      if (language) {
        whereConditions.language_id = language.language_id;
      }
    }

    // 3. Execute Query
    const scholars = await prisma.scholar_versions.findMany({
      where: whereConditions,
      include: {
        scholar_aliases: { select: { alias_name: true } },
        languages: { select: { code: true } },
        regions: { select: { name: true } },
        scholar_disciplines: { include: { disciplines: { select: { name: true } } } },
        scholar_works: { 
          where: { status: "approved" }, 
          select: { work_id: true, title: true, year: true, format: true } 
        },
        media: {
          where: { status: "approved" },
          select: { media_id: true, title: true, description: true, media_url: true, file_type: true }
        }
      },
      orderBy: { canonical_name: 'asc' },
      take: 50,
    });

    // 4. Format Response
    const formattedScholars = scholars.map((s) => {
      return {
        scholar_id: s.scholar_id,
        version_id: s.version_id,
        canonical_name: s.canonical_name,
        aliases: s.scholar_aliases?.map(a => a.alias_name).filter(Boolean) || [],
        biography: s.biography ? s.biography.substring(0, 150) + (s.biography.length > 150 ? "..." : "") : null,
        disciplines: s.scholar_disciplines?.map(sd => sd.disciplines?.name).filter(Boolean) || [],
        region: s.regions?.name ?? null,
        lang: s.languages?.code ? String(s.languages.code).toUpperCase() : "EN",
        image_url: s.image_url,
        works: s.scholar_works || [],
        media: s.media || [] // ✅ Media is attached to the response!
      };
    });

    res.json({ success: true, data: { scholars: formattedScholars } });
  } catch (error) {
    console.error("searchScholars error:", error);
    res.status(500).json({ success: false, message: "Search failed.", error: error.message });
  }
};