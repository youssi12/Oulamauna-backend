const prisma = require("../config/db");

exports.createScholar = async (req, res) => {
  const {
    scholar_id,        // optional — if provided, links to existing scholar
    canonical_name,
    aliases,
    region,
    birth_date_gregorian,
    birth_date_hijri,
    death_date_gregorian,
    death_date_hijri,
    century_hijri,
    century_gregorian,
    biography,
    language_id,
    discipline_ids,
    references,
  } = req.body;

  const userId = req.user.id;

  if (!canonical_name || !biography) {
    return res.status(400).json({
      success: false,
      message: "canonical_name and biography are required",
    });
  }

  try {
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user || !user.allowed_to_contribute) {
      return res.status(403).json({ success: false, message: "You are not allowed to contribute" });
    }

    const parsedLanguageId = language_id ? parseInt(language_id) : null;

    // If linking to an existing scholar, validate it exists and isn't already
    // covered by an approved version in this language BEFORE opening the
    // transaction, so we can return a clean 404/400 without touching the DB.
    let existingScholar = null;
    if (scholar_id) {
      existingScholar = await prisma.scholars.findUnique({
        where: { scholar_id: parseInt(scholar_id) },
      });

      if (!existingScholar) {
        return res.status(404).json({
          success: false,
          message: "Scholar not found",
        });
      }

      if (parsedLanguageId) {
        const existingVersion = await prisma.scholar_versions.findFirst({
          where: {
            scholar_id: parseInt(scholar_id),
            language_id: parsedLanguageId,
            status: "approved",
          },
        });

        if (existingVersion) {
          return res.status(400).json({
            success: false,
            message: "An approved version in this language already exists for this scholar",
          });
        }
      }
    }

    const { scholar, version } = await prisma.$transaction(async (tx) => {
      // ── Get or create the scholar identity ──
      const scholar = existingScholar
        ? existingScholar
        : await tx.scholars.create({
            data: {
              created_by: userId,
              created_at: new Date(),
            },
          });

      // ── Create the version ──
      const version = await tx.scholar_versions.create({
        data: {
          scholar_id: scholar.scholar_id,
          language_id: parsedLanguageId,
          canonical_name,
          region: region || null,
          birth_date_gerogean: birth_date_gregorian || null,
          birth_date_hijri: birth_date_hijri || null,
          death_date_gerogean: death_date_gregorian || null,
          death_date_hijri: death_date_hijri || null,
          century_hijri: century_hijri || null,
          century_gregorian: century_gregorian || null,
          biography,
          version_type: "creation",
          status: "pending",
          created_by: userId,
          created_at: new Date(),
        },
      });

      // ── Aliases ──
      if (aliases && aliases.length > 0) {
        await tx.scholar_aliases.createMany({
          data: aliases.map((alias) => ({
            version_id: version.version_id,
            alias_name: alias,
          })),
        });
      }

      // ── References ──
      if (references && references.length > 0) {
        await tx.scholar_references.createMany({
          data: references.map((ref) => ({
            version_id: version.version_id,
            title: ref.title || null,
            citation: ref.citation || null,
            url: ref.url || null,
          })),
        });
      }

      // ── Disciplines — only on new scholar, not on a language version ──
      if (!scholar_id && discipline_ids && discipline_ids.length > 0) {
        await tx.scholar_disciplines.createMany({
          data: discipline_ids.map((did) => ({
            scholar_id: scholar.scholar_id,
            discipline_id: did,
          })),
          skipDuplicates: true,
        });
      }

      // ── Track contributor ──
      await tx.scholar_contributors.upsert({
        where: {
          scholar_id_user_id: {
            scholar_id: scholar.scholar_id,
            user_id: userId,
          },
        },
        create: { scholar_id: scholar.scholar_id, user_id: userId },
        update: {},
      });

      return { scholar, version };
    });

    // ── Notify admins that a new submission needs review ──
    // NOTE: adjust the `where` clause below to match however admins are
    // identified in your schema (e.g. a `role` column instead of `is_admin`).
    const admins = await prisma.users.findMany({
      where: { is_admin: true },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notifications.createMany({
        data: admins.map((admin) => ({
          user_id: admin.id,
          type: "NEW_SCHOLAR_SUBMISSION",
          message: scholar_id
            ? `New language version submitted for scholar ID ${scholar.scholar_id}: "${canonical_name}"`
            : `New scholar submitted: "${canonical_name}"`,
          related_entity: `scholar:${scholar.scholar_id}`,
          is_read: false,
          created_at: new Date(),
        })),
      });
    }

    res.status(201).json({
      success: true,
      message: scholar_id
        ? "New language version submitted for review"
        : "Scholar submitted for review",
      data: { scholar, version },
    });
  } catch (error) {
    console.error("createScholar error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getPublishedScholars = async (req, res) => {
  const lang = req.query.lang || "ar";

  try {
    const language = await prisma.languages.findFirst({
      where: { code: lang },
    });

    if (!language) {
      return res.status(404).json({
        success: false,
        message: `Language '${lang}' not found`,
      });
    }

    const scholars = await prisma.scholars.findMany({
      where: {
        scholar_versions: {
          some: {
            status: "approved",
            language_id: language.language_id,
          },
        },
      },
      include: {
        scholar_versions: {
          where: {
            status: "approved",
            language_id: language.language_id,
          },
          orderBy: {
            created_at: "desc",
          },
          take: 1,
          include: {
            scholar_aliases: true,
            languages: true,
          },
        },
        scholar_disciplines: {
          include: {
            disciplines: {
              include: {
                discipline_translations: true,
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: scholars,
    });
  } catch (error) {
    console.error("getPublishedScholars error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getScholarById = async (req, res) => {
  const scholarId = parseInt(req.params.id);
  const { lang } = req.query; // e.g. ?lang=ar

  try {
    // Resolve language_id from code if provided
    let languageFilter = {};
    if (lang) {
      const language = await prisma.languages.findFirst({
        where: { code: lang },
      });

      if (language) {
        languageFilter = { language_id: language.language_id };
      }
    }

    const scholar = await prisma.scholars.findUnique({
      where: { scholar_id: scholarId },
      include: {
        scholar_versions: {
          where: {
            status: "approved",
            ...languageFilter,
          },
          orderBy: {
            created_at: "desc",
          },
          take: 1,
          include: {
            scholar_aliases: true,
            languages: true,
            internal_links: {
              include: {
                scholars: true,
              },
            },
          },
        },

        scholar_disciplines: {
          include: {
            disciplines: {
              include: {
                discipline_translations: true,
              },
            },
          },
        },

        media: {
          where: {
            status: "approved",
          },
        },

        bibliography: true,

        comments: {
          where: {
            deleted_at: null,
          },
          include: {
            users: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: {
            created_at: "desc",
          },
        },

        scholar_contributors: {
          include: {
            users: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },

        scholar_relationships_scholar_relationships_scholar_idToscholars: {
          include: {
            scholars_scholar_relationships_related_scholar_idToscholars: true,
          },
        },
      },
    });

    if (!scholar || scholar.scholar_versions.length === 0) {
      return res.status(404).json({
        success: false,
        message: lang
          ? `Scholar not found in language "${lang}"`
          : "Scholar not found",
      });
    }

    // Current approved version
    const currentVersion = scholar.scholar_versions[0];

    // References for this version
    const references = await prisma.scholar_references.findMany({
      where: {
        version_id: currentVersion.version_id,
      },
      orderBy: {
        reference_id: "asc",
      },
    });

    // Revision history for this scholar in the same language
    const history = await prisma.scholar_versions.findMany({
      where: {
        scholar_id: scholarId,
        language_id: currentVersion.language_id,
      },
      include: {
        users: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    // Available languages
    const availableLanguages = await prisma.scholar_versions.findMany({
      where: {
        scholar_id: scholarId,
        status: "approved",
      },
      select: {
        languages: true,
      },
      distinct: ["language_id"],
    });

    res.json({
      success: true,
      data: {
        ...scholar,
        references,
        history,
        available_languages: availableLanguages.map((v) => v.languages),
      },
    });
  } catch (error) {
    console.error("getScholarById error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.editScholar = async (req, res) => {
  const scholarId = parseInt(req.params.id);
  const userId = req.user.id;

  const {
    canonical_name,
    aliases,
    region,
    birth_date_gregorian,
    birth_date_hijri,
    death_date_gregorian,
    death_date_hijri,
    century_hijri,
    century_gregorian,
    biography,
    language_id,
    changed_fields, // array like ["biography", "region"] — for revision tracking
    references,
  } = req.body;

  if (!canonical_name || !biography) {
    return res.status(400).json({
      success: false,
      message: "canonical_name and biography are required",
    });
  }

  try {
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user || !user.allowed_to_contribute) {
      return res.status(403).json({ success: false, message: "You are not allowed to contribute" });
    }

    const scholar = await prisma.scholars.findUnique({
      where: { scholar_id: scholarId },
    });

    if (!scholar) {
      return res.status(404).json({ success: false, message: "Scholar not found" });
    }

    const parsedLanguageId = language_id ? parseInt(language_id) : null;

    // Optional safeguard: block a second pending edit in the same language
    // while one is already awaiting review. Remove this block if you'd
    // rather let moderators see/merge multiple pending edits at once.
    const existingPending = await prisma.scholar_versions.findFirst({
      where: {
        scholar_id: scholarId,
        language_id: parsedLanguageId,
        status: "pending",
        version_type: "edition",
      },
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: "A pending edit already exists for this scholar in this language",
      });
    }

    // Get latest approved version *in the same language* to snapshot what changed
    const previousVersion = await prisma.scholar_versions.findFirst({
      where: {
        scholar_id: scholarId,
        language_id: parsedLanguageId,
        status: "approved",
      },
      orderBy: { created_at: "desc" },
    });

    const newVersion = await prisma.$transaction(async (tx) => {
      // Create a new pending version
      const newVersion = await tx.scholar_versions.create({
        data: {
          scholar_id: scholarId,
          language_id: parsedLanguageId,
          canonical_name,
          region: region || null,
          birth_date_gerogean: birth_date_gregorian || null,
          birth_date_hijri: birth_date_hijri || null,
          death_date_gerogean: death_date_gregorian || null,
          death_date_hijri: death_date_hijri || null,
          century_hijri: century_hijri || null,
          century_gregorian: century_gregorian || null,
          biography,
          version_type: "edition",
          status: "pending",
          created_by: userId,
          created_at: new Date(),
        },
      });

      // Save aliases for this new version
      if (aliases && aliases.length > 0) {
        await tx.scholar_aliases.createMany({
          data: aliases.map((alias) => ({
            version_id: newVersion.version_id,
            alias_name: alias,
          })),
        });
      }

      if (references && references.length > 0) {
        await tx.scholar_references.createMany({
          data: references.map((ref) => ({
            version_id: newVersion.version_id,
            title: ref.title || null,
            citation: ref.citation || null,
            url: ref.url || null,
          })),
        });
      }

      // Add as contributor if not already
      await tx.scholar_contributors.upsert({
        where: {
          scholar_id_user_id: { scholar_id: scholarId, user_id: userId },
        },
        create: { scholar_id: scholarId, user_id: userId },
        update: {},
      });

      return newVersion;
    });

    // ── Notify admins that an edit needs review ──
    // NOTE: adjust the `where` clause below to match however admins are
    // identified in your schema (e.g. a `role` column instead of `is_admin`).
    const admins = await prisma.users.findMany({
      where: { is_admin: true },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notifications.createMany({
        data: admins.map((admin) => ({
          user_id: admin.id,
          type: "EDIT_PROPOSAL",
          message: `Edit proposed for scholar ID ${scholarId} ("${canonical_name}")`,
          related_entity: `scholar_version:${newVersion.version_id}`,
          is_read: false,
          created_at: new Date(),
        })),
      });
    }

    res.json({
      success: true,
      message: "Edit submitted for review",
      data: newVersion,
    });
  } catch (error) {
    console.error("editScholar error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getMySubmissions = async (req, res) => {
  const userId = req.user.id;

  try {
    const submissions = await prisma.scholar_versions.findMany({
      where: { created_by: userId },
      include: {
        scholars: true,
        languages: true,
      },
      orderBy: { created_at: "desc" },
    });

    res.json({ success: true, data: submissions });
  } catch (error) {
    console.error("getMySubmissions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};