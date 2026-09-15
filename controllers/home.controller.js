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
  const languageId = langRecord?.language_id || 1;

  const rows = await prisma.scholar_versions.findMany({
    where: {
      status: APPROVED,
      language_id: languageId
    },
    orderBy: { version_id: "asc" },
    take: 4,
    include: {
      regions: true,
      scholar_disciplines: {
        take: 1,
        orderBy: { discipline_id: "asc" },
        include: { disciplines: true },
      },
    },
  });

  return rows.map((s) => ({
    scholar_id: s.scholar_id,
    version_id: s.version_id,
    canonical_name: s.canonical_name,
    century_gregorian_start: s.century_gregorian_start,
    century_gregorian_end: s.century_gregorian_end,
    region_name: s.regions?.name ?? null,
    discipline_name: s.scholar_disciplines[0]?.disciplines?.name ?? null,
    image_url: s.image_url,
    biography: s.biography,
  }));
}

async function getRecentScholars() {
  const recentVersions = await prisma.scholar_versions.findMany({
    where: {
      status: 'approved',
    },
    orderBy: {
      created_at: 'desc',
    },
    take: 4,
    select: {
      version_id: true,
      scholar_id: true,
      canonical_name: true,
      century_gregorian_start: true,
      image_url: true,
      created_at: true,
      languages: {
        select: {
          code: true,
        }
      }
    },
  });

  return recentVersions.map((version) => ({
    scholar_id: version.scholar_id,
    version_id: version.version_id,
    canonical_name: version.canonical_name,
    century_gregorian_start: version.century_gregorian_start,
    image_url: version.image_url,
    created_at: version.created_at,
    language_code: version.languages?.code || 'EN',
  }));
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
      d.name AS name,
      COUNT(DISTINCT sv.scholar_id) AS count
    FROM disciplines d
    LEFT JOIN scholar_disciplines sd ON sd.discipline_id = d.discipline_id
    LEFT JOIN scholar_versions sv
      ON sv.version_id = sd.version_id 
      AND sv.status = ${APPROVED}
      AND sv.language_id = ${languageId}
    GROUP BY d.discipline_id, d.name
    ORDER BY count DESC
    LIMIT 6
  `;

  return rows.map((d) => ({
    discipline_id: Number(d.discipline_id),
    name: d.name,
    count: Number(d.count),
  }));
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
    where: { status: APPROVED },
    orderBy: { work_id: "desc" },
    take: 3,
    include: {
      scholar_versions: {
        select: {
          scholar_id: true,
          languages: {
            select: { code: true }
          }
        }
      }
    }
  });

  return rows.map((w) => ({
    work_id: w.work_id,
    scholar_id: w.scholar_versions?.scholar_id || null,
    work_lang: w.scholar_versions?.languages?.code || "EN",
    title: w.title,
    year: w.year,
    format: w.format,
    media_url: w.media_url,
    description: w.description,
  }));
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
    ] = await Promise.all([
      getFeaturedScholars(lang),
      getRecentScholars(lang),
      getDisciplines(lang),
      getEras(lang),
      getFeaturedWorks(),
      getStats(lang),
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