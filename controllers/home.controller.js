const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ERA_DEFINITIONS = [
  {
    name: "Classical Era",
    period: "7th-8th Century",
    startYear: 600,
    endYear: 749,
    image_url:
      "https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?w=600&h=200&fit=crop",
  },

  {
    name: "Golden Age",
    period: "8th-13th Century",
    startYear: 750,
    endYear: 1258,
    image_url:
      "https://images.unsplash.com/photo-1542037108280-496739ed6887?w=600&h=200&fit=crop",
  },

  {
    name: "Andalusian Era",
    period: "8th-15th Century",
    startYear: 711,
    endYear: 1492,
    image_url:
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&h=200&fit=crop",
  },

  {
    name: "Ottoman Era",
    period: "14th-19th Century",
    startYear: 1299,
    endYear: 1899,
    image_url:
      "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=600&h=200&fit=crop",
  },

  {
    name: "Modern Era",
    period: "20th Century - Present",
    startYear: 1900,
    endYear: new Date().getFullYear(),
    image_url:
      "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=200&fit=crop",
  },
];
const APPROVED = "approved";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function getFeaturedScholars(lang = 'EN') {
  const langRecord = await prisma.languages.findFirst({
    where: { code: lang },
    select: { language_id: true },
  });
  const requestedLangId = langRecord?.language_id || 1;

  const scholars = await prisma.scholars.findMany({
    where: { is_featured: true },
    include: {
      scholar_versions: {
        where: { status: "approved" }, // ✅ REMOVED language_id filter to allow fallback
        include: {
          languages: true,
          regions: true,
          scholar_dates: { where: { date_type: "birth" }, take: 1 },
          scholar_disciplines: { take: 1, orderBy: { discipline_id: "asc" }, include: { disciplines: true } },
        },
      },
    },
    orderBy: { created_at: "desc" },
    take: 4,
  });

  return scholars
    .filter(s => s.scholar_versions.length > 0)
    .map(scholar => {
      // 1. Try to find the requested language first
      let version = scholar.scholar_versions.find(v => v.language_id === requestedLangId);
      let isFallback = false;

      // 2. If not found, fallback to the FIRST available approved language
      if (!version) {
        version = scholar.scholar_versions[0];
        isFallback = true;
      }

      return {
        scholar_id: scholar.scholar_id,
        version_id: version.version_id,
        canonical_name: version.canonical_name,
        century_gregorian_start: version.century_gregorian_start,
        century_gregorian_end: version.century_gregorian_end,
        region_name: version.regions?.name || null,
        discipline_name: version.scholar_disciplines[0]?.disciplines?.name || null,
        image_url: version.image_url,
        biography: version.biography,
        language_code: version.languages?.code || lang,
        isFallback: isFallback, // ✅ Tells frontend to show a warning
      };
    });
}
async function getRecentScholars(lang = 'EN') {
  const langRecord = await prisma.languages.findFirst({
    where: { code: lang },
    select: { language_id: true },
  });
  const requestedLangId = langRecord?.language_id || 1;

  const scholars = await prisma.scholars.findMany({
    include: {
      scholar_versions: {
        where: { status: "approved" },
        include: { languages: true },
      },
    },
    orderBy: { created_at: "desc" },
    take: 4,
  });

  return scholars
    .filter(s => s.scholar_versions.length > 0)
    .map(scholar => {
      let version = scholar.scholar_versions.find(v => v.language_id === requestedLangId);
      let isFallback = false;

      if (!version) {
        version = scholar.scholar_versions[0];
        isFallback = true;
      }

      return {
        scholar_id: scholar.scholar_id,
        version_id: version.version_id,
        canonical_name: version.canonical_name,
        century_gregorian_start: version.century_gregorian_start,
        image_url: version.image_url,
        created_at: scholar.created_at,
        language_code: version.languages?.code || lang,
        isFallback: isFallback,
      };
    });
}

async function getDisciplines(lang = 'EN') {
  const langRecord = await prisma.languages.findFirst({
    where: { code: lang },
    select: { language_id: true },
  });
  const languageId = langRecord?.language_id || 1;

  const rows = await prisma.$queryRaw`
    SELECT
      d.discipline_id AS discipline_id,
      d.name AS default_name,
      d.translations AS translations,
      d.image_url AS image_url,
      COUNT(DISTINCT sv.scholar_id) AS count
    FROM disciplines d
    LEFT JOIN scholar_disciplines sd ON sd.discipline_id = d.discipline_id
    LEFT JOIN scholar_versions sv
      ON sv.version_id = sd.version_id 
      AND sv.status = ${APPROVED}
      AND sv.language_id = ${languageId}
    GROUP BY d.discipline_id, d.name, d.translations, d.image_url
    HAVING count > 0
    ORDER BY count DESC
  `;

  return rows.map((d) => {
    let displayName = d.default_name; // Fallback to default name

    if (d.translations) {
      try {
        // Parse the JSON string returned by MySQL
        const trans = typeof d.translations === 'string' ? JSON.parse(d.translations) : d.translations;
        
        // ✅ Bulletproof fallback: checks exact match, uppercase, lowercase, then English, then default
        displayName = trans[lang] || trans[lang.toUpperCase()] || trans[lang.toLowerCase()] || trans['EN'] || trans['en'] || d.default_name;
      } catch (e) {
        console.error("Error parsing translations JSON for discipline:", d.discipline_id, e);
      }
    }

    return {
      discipline_id: Number(d.discipline_id), // ✅ Safely converts BigInt to Number
      name: displayName,                      // ✅ Returns the translated name!
      image_url: d.image_url || null,
      count: Number(d.count),                 // ✅ Safely converts BigInt to Number
    };
  });
}

async function getEras(lang = "EN") {
  const langRecord = await prisma.languages.findFirst({
    where: { code: lang },
    select: { language_id: true },
  });

  const languageId = langRecord?.language_id || 1;

  // Get approved scholars and their DEATH year
  const approvedVersions = await prisma.scholar_versions.findMany({
    where: {
      status: APPROVED,
      language_id: languageId,
    },
    select: {
      scholar_id: true,
      scholar_dates: {
        where: {
          date_type: "death",
          calendar: "gregorian",
        },
        select: {
          year: true,
        },
      },
    },
  });

  // Create the era cards
  const eras = ERA_DEFINITIONS.map((era) => ({
    name: era.name,
    period: era.period,
    image_url: era.image_url,
    scholars_count: 0,
    startYear: era.startYear,
    endYear: era.endYear,
  }));

  // Prevent the same scholar from being counted more than once
  const countedScholars = new Set();

  for (const scholar of approvedVersions) {
    // Get death year instead of birth year
    const deathYear = scholar.scholar_dates?.[0]?.year;

    if (!deathYear) {
      continue;
    }

    // Do not count the same scholar twice
    if (countedScholars.has(scholar.scholar_id)) {
      continue;
    }

    // Find the first era matching the scholar's death year
    const eraIndex = ERA_DEFINITIONS.findIndex(
      (era) =>
        deathYear >= era.startYear &&
        deathYear <= era.endYear
    );

    if (eraIndex !== -1) {
      eras[eraIndex].scholars_count++;
      countedScholars.add(scholar.scholar_id);
    }
  }

  return eras;
}
async function getFeaturedWorks() {
  const rows = await prisma.scholar_works.findMany({
    where: { 
      status: APPROVED,
      is_featured: true, 
    },
    orderBy: { work_id: "desc" },
    take: 4, 
    include: {
      // ✅ For singular relations, we ONLY use 'select', no 'where' or 'take'
      scholar_versions: {
        select: {
          scholar_id: true,
          canonical_name: true, 
          languages: {
            select: { code: true }
          }
        }
      }
    }
  });

  return rows.map((w) => {
    // ✅ w.scholar_versions is a single object, not an array!
    const version = w.scholar_versions; 
    
    return {
      work_id: w.work_id,
      scholar_id: version?.scholar_id || null,
      scholar_name: version?.canonical_name || null, 
      work_lang: version?.languages?.code || "EN",
      title: w.title,
      year: w.year,
      format: w.format,
      media_url: w.media_url,
      description: w.description,
    };
  });
}

async function getStats(lang = 'EN') {
  const langRecord = await prisma.languages.findFirst({
    where: { code: lang },
    select: { language_id: true },
  });

  const languageId = langRecord?.language_id || 1;

  const [scholars, manuscripts, disciplines, centuryAgg] = await Promise.all([
    prisma.scholars.count(),
    prisma.scholar_works.count({
      where: {
        status: APPROVED,
        scholar_versions: {
          language_id: languageId,
        },
      },
    }),
    prisma.disciplines.count(),
    prisma.scholar_versions.aggregate({
      where: {
        status: APPROVED,
        language_id: languageId,
      },
      _min: { century_gregorian_start: true },
      _max: { century_gregorian_end: true },
    }),
  ]);

  const minYear = centuryAgg._min.century_gregorian_start;
  const maxYear = centuryAgg._max.century_gregorian_end;
  const centuries =
    minYear != null && maxYear != null
      ? Math.max(1, Math.ceil((maxYear - minYear) / 100))
      : 0;

  return { scholars, manuscripts, disciplines, centuries };
}
async function getPopularForumPosts() {
  const posts = await prisma.forum_posts.findMany({
    where: {
      deleted_at: null,
      is_hidden: false, // ✅ Only show visible, non-deleted posts
    },
    orderBy: {
      like_count: 'desc', // ✅ Sort by most likes first
    },
    take: 4, // ✅ Top 4 popular posts
    include: {
      users: {
        select: { 
          id: true, 
          username: true, 
          name: true, 
          profile_picture: true 
        }
      },
      forum_categories: {
        select: { 
          category_id: true, 
          name: true 
        }
      },
      _count: {
        select: { 
          forum_comments: true // ✅ Get the comment count
        }
      }
    }
  });

  return posts.map(post => ({
    post_id: post.post_id,
    title: post.title,
    excerpt: post.content.length > 120 ? post.content.substring(0, 120) + '...' : post.content,
    like_count: post.like_count || 0,
    comment_count: post._count.forum_comments || 0,
    author: {
      id: post.users?.id,
      username: post.users?.username,
      name: post.users?.name,
      profile_picture: post.users?.profile_picture
    },
    category: post.forum_categories,
    created_at: post.created_at
  }));
}
/* ------------------------------------------------------------------ */
/*  Controller                                                         */
/* ------------------------------------------------------------------ */
exports.getHomeData = async (req, res) => {
  try {
    const lang = req.query.lang || 'EN';

    const [
      featuredScholars,
      recentScholars,
      disciplines,
      eras,
      featuredWorks,
      stats,
      popularForumPosts, // ✅ ADD THIS
    ] = await Promise.all([
      getFeaturedScholars(lang),
      getRecentScholars(lang),
      getDisciplines(lang),
      getEras(lang),
      getFeaturedWorks(),
      getStats(lang),
      getPopularForumPosts(), // ✅ ADD THIS
    ]);

    return res.status(200).json({
      success: true,
      data: {
        featuredScholars,
        recentScholars,
        disciplines,
        eras,
        featuredWorks,
        stats,
        popularForumPosts, // ✅ ADD THIS
      },
    });
  } catch (err) {
    console.error("[home.controller] getHomeData error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load home page data.",
    });
  }
};