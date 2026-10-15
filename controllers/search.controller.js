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

 // =========================================================
// Replace findCorrectedSearchTerm + searchScholars with this.
// Keep your existing: prisma, Fuse, normalizeText,
// findMatchingRegionIds, findMatchingDisciplineIds, globalSearch.
// =========================================================

// ---------- tuning knobs ----------
const MAX_RESULTS = 10;        // max scholars returned for a normal (non-exact) match
const RANKING_POOL = 500;      // candidates pulled (lightweight) for ranking before cutting
const FUZZY_MAX_RESULTS = 5;   // max scholars returned from the fuzzy fallback
const FUZZY_MARGIN = 0.1;      // keep fuzzy results within this score of the best one
const FUZZY_STRONG_MATCH = 0.05; // if the best fuzzy score is this good, return ONLY it

// Shared include so the response shape is defined in one place
const SCHOLAR_INCLUDE = {
  scholar_aliases: { select: { alias_name: true } },
  languages: { select: { code: true } },
  regions: { select: { name: true } },
  scholar_disciplines: { include: { disciplines: { select: { name: true } } } },
  scholar_works: {
    where: { status: "approved" },
    select: { work_id: true, title: true, year: true, format: true },
  },
  media: {
    where: { status: "approved" },
    select: { media_id: true, title: true, description: true, media_url: true, file_type: true },
  },
};

// ---------------------------------------------------------
// WHERE builder (same logic as before, hoisted so it can be reused)
// ---------------------------------------------------------
async function buildWhereConditions(term, languageId) {
  const whereConditions = {
    status: "approved",
    scholar_id: { not: null },
    ...(languageId ? { language_id: languageId } : {}),
  };

  if (term !== "") {
    const [matchingRegionIds, matchingDisciplineIds] = await Promise.all([
      findMatchingRegionIds(term),
      findMatchingDisciplineIds(term),
    ]);

    whereConditions.OR = [
      { canonical_name: { contains: term } },
      { scholar_aliases: { some: { alias_name: { contains: term } } } },
      { biography: { contains: term } },
      ...(matchingRegionIds.length > 0 ? [{ region_id: { in: matchingRegionIds } }] : []),
      ...(matchingDisciplineIds.length > 0
        ? [{ scholar_disciplines: { some: { discipline_id: { in: matchingDisciplineIds } } } }]
        : []),
      { scholar_works: { some: { title: { contains: term } } } },
      { media: { some: { title: { contains: term } } } },
      { media: { some: { description: { contains: term } } } },
    ];
  }

  return whereConditions;
}

// ---------------------------------------------------------
// Ranking for normal (substring) results.
// Higher = closer. >= 100 means exact name/alias match.
// ---------------------------------------------------------
function scoreByName(scholar, normalizedTerm) {
  const names = [
    scholar.canonical_name,
    ...(scholar.scholar_aliases || []).map((a) => a.alias_name),
  ]
    .filter(Boolean)
    .map(normalizeText);

  let best = 20; // matched through a non-name field (bio, region, discipline, works, media)

  for (const n of names) {
    let score;
    if (n === normalizedTerm) score = 100;                                      // exact
    else if (n.startsWith(normalizedTerm)) score = 80;                          // name starts with term
    else if (n.split(" ").some((w) => w.startsWith(normalizedTerm))) score = 70; // any word starts with term
    else if (n.includes(normalizedTerm)) score = 60;                            // term appears inside
    else continue;

    score += normalizedTerm.length / n.length; // tie-breaker: closer length = closer match
    if (score > best) best = score;
  }

  return best;
}

// ---------------------------------------------------------
// Fuzzy fallback: returns closest scholars (version-level), best first.
// ---------------------------------------------------------
async function findFuzzyMatches(searchTerm, languageId = null) {
  const normalizedSearch = normalizeText(searchTerm);

  const candidates = await prisma.scholar_versions.findMany({
    where: {
      status: "approved",
      scholar_id: { not: null },
      ...(languageId ? { language_id: languageId } : {}),
    },
    select: {
      version_id: true,
      canonical_name: true,
      scholar_aliases: { select: { alias_name: true } },
    },
  });

  // One searchable entry per name/alias, remembering which scholar version it belongs to
  const entries = [];
  for (const s of candidates) {
    if (s.canonical_name) {
      entries.push({ version_id: s.version_id, normalized: normalizeText(s.canonical_name) });
    }
    for (const a of s.scholar_aliases || []) {
      if (a.alias_name) {
        entries.push({ version_id: s.version_id, normalized: normalizeText(a.alias_name) });
      }
    }
  }
  if (entries.length === 0) return [];

  const fuse = new Fuse(entries, {
    keys: ["normalized"],
    threshold: 0.45,
    ignoreLocation: true,
    includeScore: true,
  });

  const results = fuse.search(normalizedSearch);
  if (results.length === 0) return [];

  // A scholar can match via its name AND several aliases: keep only its best score
  const bestByVersion = new Map();
  for (const r of results) {
    const prev = bestByVersion.get(r.item.version_id);
    if (prev === undefined || r.score < prev) bestByVersion.set(r.item.version_id, r.score);
  }

  const ranked = [...bestByVersion.entries()]
    .map(([version_id, score]) => ({ version_id, score }))
    .sort((a, b) => a.score - b.score);

  // One very strong match -> return only that one
  if (ranked[0].score <= FUZZY_STRONG_MATCH) return [ranked[0]];

  // Otherwise: the best match plus anything close to it, capped
  const cutoff = ranked[0].score + FUZZY_MARGIN;
  return ranked.filter((r) => r.score <= cutoff).slice(0, FUZZY_MAX_RESULTS);
}

// ---------------------------------------------------------
// Fetch full records, preserving the ranked order
// ---------------------------------------------------------
async function fetchScholarsInOrder(versionIds) {
  if (versionIds.length === 0) return [];

  const rows = await prisma.scholar_versions.findMany({
    where: { version_id: { in: versionIds } },
    include: SCHOLAR_INCLUDE,
  });

  const byId = new Map(rows.map((r) => [r.version_id, r]));
  return versionIds.map((id) => byId.get(id)).filter(Boolean);
}

// =========================================================
// Controller
// =========================================================
exports.searchScholars = async (req, res) => {
  try {
    const { q, lang } = req.query;
    const searchTerm = q ? String(q).trim() : "";
    const normalizedTerm = normalizeText(searchTerm);

    // 1. Resolve language
    let languageId = null;
    if (lang) {
      const language = await prisma.languages.findFirst({
        where: { code: String(lang).toLowerCase() },
      });
      if (language) languageId = language.language_id;
    }

    let orderedIds = [];
    let matchType = "none"; // "browse" | "exact" | "partial" | "fuzzy" | "none"

    if (searchTerm === "") {
      // 2a. No query: plain alphabetical browse
      const rows = await prisma.scholar_versions.findMany({
        where: await buildWhereConditions("", languageId),
        select: { version_id: true },
        orderBy: { canonical_name: "asc" },
        take: 50,
      });
      orderedIds = rows.map((r) => r.version_id);
      matchType = "browse";
    } else {
      // 2b. Normal search: lightweight pull, rank in JS
      const pool = await prisma.scholar_versions.findMany({
        where: await buildWhereConditions(searchTerm, languageId),
        select: {
          version_id: true,
          canonical_name: true,
          scholar_aliases: { select: { alias_name: true } },
        },
        take: RANKING_POOL,
      });

      if (pool.length > 0) {
        const ranked = pool
          .map((s) => ({
            version_id: s.version_id,
            canonical_name: s.canonical_name || "",
            score: scoreByName(s, normalizedTerm),
          }))
          .sort((a, b) => b.score - a.score || a.canonical_name.localeCompare(b.canonical_name));

        const exact = ranked.filter((r) => r.score >= 100);

        if (exact.length > 0) {
          // Correct match found: return ONLY it
          orderedIds = exact.map((r) => r.version_id);
          matchType = "exact";
        } else {
          // Closest few, best first
          orderedIds = ranked.slice(0, MAX_RESULTS).map((r) => r.version_id);
          matchType = "partial";
        }
      } else {
        // 3. Nothing found -> fuzzy fallback (closest few, best first)
        const fuzzy = await findFuzzyMatches(searchTerm, languageId);
        if (fuzzy.length > 0) {
          orderedIds = fuzzy.map((f) => f.version_id);
          matchType = "fuzzy";
        }
      }
    }

    // 4. Fetch full records in ranked order
    const scholars = await fetchScholarsInOrder(orderedIds);

    // 5. Format response
    const formattedScholars = scholars.map((s) => ({
      scholar_id: s.scholar_id,
      version_id: s.version_id,
      canonical_name: s.canonical_name,
      aliases: s.scholar_aliases?.map((a) => a.alias_name).filter(Boolean) || [],
      biography: s.biography
        ? s.biography.substring(0, 150) + (s.biography.length > 150 ? "..." : "")
        : null,
      disciplines: s.scholar_disciplines?.map((sd) => sd.disciplines?.name).filter(Boolean) || [],
      region: s.regions?.name ?? null,
      lang: s.languages?.code ? String(s.languages.code).toUpperCase() : "EN",
      image_url: s.image_url,
      works: s.scholar_works || [],
      media: s.media || [],
    }));

    res.json({
      success: true,
      data: {
        scholars: formattedScholars,
        search: {
          originalQuery: searchTerm,
          // for fuzzy matches: the name of the top result, so the UI can say "Showing results for X"
          correctedQuery: matchType === "fuzzy" ? scholars[0]?.canonical_name ?? null : null,
          wasCorrected: matchType === "fuzzy",
          matchType,
        },
      },
    });
  } catch (error) {
    console.error("searchScholars error:", error);
    res.status(500).json({ success: false, message: "Search failed.", error: error.message });
  }
};


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