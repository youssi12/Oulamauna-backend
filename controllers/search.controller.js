const prisma = require("../config/db");
const Fuse = require("fuse.js");

function normalizeText(text) {
  return String(text || "")
   .normalize("NFD")
   .replace(/[\u0300-\u036f]/g, "") // 
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const escapeLike = (s) => s.replace(/[\\%_]/g, "\\$&");

async function findMatchingRegionIds(term) {
  if (!term) return [];
  const pattern = `%${escapeLike(term)}%`;

  const rows = await prisma.$queryRaw`
    SELECT region_id
    FROM regions
    WHERE LOWER(name) LIKE LOWER(${pattern})
       OR JSON_SEARCH(LOWER(translations), 'one', LOWER(${pattern})) IS NOT NULL
  `;

  return rows.map((r) => r.region_id);
}

async function findMatchingDisciplineIds(term) {
  if (!term) return [];
  const pattern = `%${escapeLike(term)}%`;

  const rows = await prisma.$queryRaw`
    SELECT discipline_id
    FROM disciplines
    WHERE LOWER(name) LIKE LOWER(${pattern})
       OR JSON_SEARCH(LOWER(translations), 'one', LOWER(${pattern})) IS NOT NULL
  `;

  return rows.map((r) => r.discipline_id);
}

 async function findCorrectedSearchTerm(searchTerm, languageId = null) {
  const normalizedSearch = normalizeText(searchTerm);

  const candidates = await prisma.scholar_versions.findMany({
    where: {
      status: "approved",
      scholar_id: { not: null },
      ...(languageId ? { language_id: languageId } : {}),
    },
    select: {
      canonical_name: true,
      scholar_aliases: { select: { alias_name: true } },
    },
  });

  const fuzzyCandidates = [];

  for (const scholar of candidates) {
    if (scholar.canonical_name) {
      fuzzyCandidates.push({
        text: scholar.canonical_name,
        normalized: normalizeText(scholar.canonical_name),
      });
    }
    for (const alias of scholar.scholar_aliases || []) {
      if (alias.alias_name) {
        fuzzyCandidates.push({
          text: alias.alias_name,
          normalized: normalizeText(alias.alias_name),
        });
      }
    }
  }

  if (fuzzyCandidates.length === 0) {
    return null;
  }

  const fuse = new Fuse(fuzzyCandidates, {
    keys: ["normalized"],
    threshold: 0.45,
    ignoreLocation: true,
    includeScore: true,
  });

  const results = fuse.search(normalizedSearch);

  if (results.length === 0) {
    return null;
  }

  const bestMatch = results[0];

  if (bestMatch.score > 0.45) {
    return null;
  }

  return bestMatch.item.text;
}


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

    const searchTerm = q
      ? String(q).trim()
      : "";

    let actualSearchTerm = searchTerm;
    let correctedSearchTerm = null;

    // -----------------------------------------------------
    // 1. Resolve language first
    // -----------------------------------------------------

    let languageId = null;

    if (lang) {

      const language = await prisma.languages.findFirst({
        where: {
          code: String(lang).toLowerCase()
        }
      });

      if (language) {
        languageId = language.language_id;
      }
    }


    // -----------------------------------------------------
    // 2. Build normal search conditions
    // -----------------------------------------------------

     const buildWhereConditions = async (term) => {

  const whereConditions = {
    status: "approved",
    scholar_id: { not: null },

    ...(languageId
      ? { language_id: languageId }
      : {})
  };


  if (term !== "") {

    const [matchingRegionIds, matchingDisciplineIds] = await Promise.all([
      findMatchingRegionIds(term),
      findMatchingDisciplineIds(term),
    ]);

    whereConditions.OR = [

      // Scholar name
      {
        canonical_name: {
          contains: term
        }
      },

      // Aliases
      {
        scholar_aliases: {
          some: {
            alias_name: {
              contains: term
            }
          }
        }
      },

      // Biography
      {
        biography: {
          contains: term
        }
      },

      // Region — matched via resolved IDs (name + translations)
      ...(matchingRegionIds.length > 0
        ? [{ region_id: { in: matchingRegionIds } }]
        : []),

      // Discipline — same idea
      ...(matchingDisciplineIds.length > 0
        ? [{ scholar_disciplines: { some: { discipline_id: { in: matchingDisciplineIds } } } }]
        : []),

      // Works
      {
        scholar_works: {
          some: {
            title: {
              contains: term
            }
          }
        }
      },

      // Media title
      {
        media: {
          some: {
            title: {
              contains: term
            }
          }
        }
      },

      // Media description
      {
        media: {
          some: {
            description: {
              contains: term
            }
          }
        }
      }

    ];
  }

  return whereConditions;
};

    // -----------------------------------------------------
    // 3. First attempt = normal search
    // -----------------------------------------------------

    let whereConditions =
       await  buildWhereConditions(actualSearchTerm);


    let scholars = await prisma.scholar_versions.findMany({

      where: whereConditions,

      include: {

        scholar_aliases: {
          select: {
            alias_name: true
          }
        },

        languages: {
          select: {
            code: true
          }
        },

        regions: {
          select: {
            name: true
          }
        },

        scholar_disciplines: {
          include: {
            disciplines: {
              select: {
                name: true
              }
            }
          }
        },

        scholar_works: {

          where: {
            status: "approved"
          },

          select: {
            work_id: true,
            title: true,
            year: true,
            format: true
          }

        },

        media: {

          where: {
            status: "approved"
          },

          select: {
            media_id: true,
            title: true,
            description: true,
            media_url: true,
            file_type: true
          }

        }

      },

      orderBy: {
        canonical_name: "asc"
      },

      take: 50

    });


    // -----------------------------------------------------
    // 4. If nothing found → fuzzy correction
    // -----------------------------------------------------

    if (
      searchTerm !== "" &&
      scholars.length === 0
    ) {

      correctedSearchTerm =
        await findCorrectedSearchTerm(
          searchTerm,
          languageId
        );


      // We found a likely correction
      if (
        correctedSearchTerm &&
        normalizeText(correctedSearchTerm) !==
        normalizeText(searchTerm)
      ) {

        actualSearchTerm = correctedSearchTerm;

        whereConditions =
          await buildWhereConditions(actualSearchTerm);


        // Search again using corrected term
        scholars =
          await prisma.scholar_versions.findMany({

            where: whereConditions,

            include: {

              scholar_aliases: {
                select: {
                  alias_name: true
                }
              },

              languages: {
                select: {
                  code: true
                }
              },

              regions: {
                select: {
                  name: true
                }
              },

              scholar_disciplines: {
                include: {
                  disciplines: {
                    select: {
                      name: true
                    }
                  }
                }
              },

              scholar_works: {
                where: {
                  status: "approved"
                },
                select: {
                  work_id: true,
                  title: true,
                  year: true,
                  format: true
                }
              },

              media: {
                where: {
                  status: "approved"
                },
                select: {
                  media_id: true,
                  title: true,
                  description: true,
                  media_url: true,
                  file_type: true
                }
              }

            },

            orderBy: {
              canonical_name: "asc"
            },

            take: 50

          });

      }

    }


    // -----------------------------------------------------
    // 5. Format response
    // -----------------------------------------------------

    const formattedScholars = scholars.map((s) => {

      return {

        scholar_id: s.scholar_id,

        version_id: s.version_id,

        canonical_name: s.canonical_name,

        aliases:
          s.scholar_aliases
            ?.map(a => a.alias_name)
            .filter(Boolean) || [],

        biography:
          s.biography
            ? s.biography.substring(0, 150) +
              (s.biography.length > 150 ? "..." : "")
            : null,

        disciplines:
          s.scholar_disciplines
            ?.map(
              sd => sd.disciplines?.name
            )
            .filter(Boolean) || [],

        region:
          s.regions?.name ?? null,

        lang:
          s.languages?.code
            ? String(s.languages.code).toUpperCase()
            : "EN",

        image_url: s.image_url,

        works: s.scholar_works || [],

        media: s.media || []

      };

    });


    // -----------------------------------------------------
    // 6. Response
    // -----------------------------------------------------

    res.json({

      success: true,

      data: {

        scholars: formattedScholars,

        // Useful for frontend
        search: {

          originalQuery: searchTerm,

          correctedQuery: correctedSearchTerm,

          wasCorrected:
            Boolean(correctedSearchTerm)

        }

      }

    });


  } catch (error) {

    console.error(
      "searchScholars error:",
      error
    );

    res.status(500).json({

      success: false,

      message: "Search failed.",

      error: error.message

    });

  }

};








//////////////////* keep *///////////////////

/**
 * 
 * 
 * 
 * 
 * 
 * // New helper — fuzzy-matches ONLY canonical_name (not aliases, not biography),
// scoped specifically for globalSearch's lightweight scholar fallback.
async function findCorrectedScholarName(searchTerm) {
  const normalizedSearch = normalizeText(searchTerm);

  const candidates = await prisma.scholar_versions.findMany({
    where: { status: "approved", scholar_id: { not: null } },
    select: { canonical_name: true },
  });

  const fuzzyCandidates = candidates
    .filter((c) => c.canonical_name)
    .map((c) => ({ text: c.canonical_name, normalized: normalizeText(c.canonical_name) }));

  if (fuzzyCandidates.length === 0) return null;

  const fuse = new Fuse(fuzzyCandidates, {
    keys: ["normalized"],
    threshold: 0.45,
    ignoreLocation: true,
    includeScore: true,
  });

  const results = fuse.search(normalizedSearch);
  if (results.length === 0) return null;

  return results[0].item.text;
}

exports.globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === "") {
      return res.json({ success: true, data: { scholars: [], works: [], media: [], posts: [] } });
    }

    const searchTerm = q.trim();

    // ── Scholars: exact match first, ordered by most recently created ──
    let scholars = await prisma.scholar_versions.findMany({
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
      orderBy: { created_at: "desc" }, // latest first
      take: 5,
    });

    // ── If nothing found, try a fuzzy correction on canonical_name only ──
    let correctedName = null;
    if (scholars.length === 0) {
      correctedName = await findCorrectedScholarName(searchTerm);

      if (correctedName && normalizeText(correctedName) !== normalizeText(searchTerm)) {
        scholars = await prisma.scholar_versions.findMany({
          where: {
            status: "approved",
            scholar_id: { not: null },
            canonical_name: { contains: correctedName },
          },
          include: {
            scholar_disciplines: { take: 1, include: { disciplines: true } },
            regions: true,
            languages: true,
          },
          orderBy: { created_at: "desc" },
          take: 5,
        });
      }
    }

    // ── Works, media, posts — unchanged ──
    const [works, media, posts] = await Promise.all([
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
      search: {
        originalQuery: searchTerm,
        correctedScholarName: correctedName,
        scholarsWereCorrected: Boolean(correctedName),
      },
    });
  } catch (error) {
    console.error("[search.controller] globalSearch error:", error);
    res.status(500).json({ success: false, message: "Search failed." });
  }
};
 */