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
  } = req.body;

  const userId = req.user.id;

  if (!canonical_name || !biography) {
    return res.status(400).json({
      success: false,
      message: "canonical_name and biography are required",
    });
  }

  try {
    let scholar;

    if (scholar_id) {
      // ── Linking to an existing scholar (new language version) ──
      scholar = await prisma.scholars.findUnique({
        where: { scholar_id: parseInt(scholar_id) },
      });

      if (!scholar) {
        return res.status(404).json({
          success: false,
          message: "Scholar not found",
        });
      }

      // Block if an approved version in this language already exists
      if (language_id) {
        const existingVersion = await prisma.scholar_versions.findFirst({
          where: {
            scholar_id: parseInt(scholar_id),
            language_id: parseInt(language_id),
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
    } else {
      // ── Brand new scholar ──
      scholar = await prisma.scholars.create({
        data: {
          created_by: userId,
          created_at: new Date(),
        },
      });
    }

    // Create the version
    const version = await prisma.scholar_versions.create({
      data: {
        scholar_id: scholar.scholar_id,
        language_id: language_id ? parseInt(language_id) : null,
        canonical_name,
        region: region || null,
        birth_date_gerogean: birth_date_gregorian || null,
        birth_date_hijri: birth_date_hijri || null,
        death_date_gerogean: death_date_gregorian || null,
        death_date_hijri: death_date_hijri || null,
        century_hijri: century_hijri || null,
        century_gregorian: century_gregorian || null,
        biography,
        status: "pending",
        created_by: userId,
        created_at: new Date(),
      },
    });

    // Save aliases
    if (aliases && aliases.length > 0) {
      await prisma.scholar_aliases.createMany({
        data: aliases.map((alias) => ({
          version_id: version.version_id,
          alias_name: alias,
        })),
      });
    }

    // Link disciplines — only on new scholar, not on a language version
    if (!scholar_id && discipline_ids && discipline_ids.length > 0) {
      await prisma.scholar_disciplines.createMany({
        data: discipline_ids.map((did) => ({
          scholar_id: scholar.scholar_id,
          discipline_id: did,
        })),
        skipDuplicates: true,
      });
    }

    // Track contributor
    await prisma.scholar_contributors.upsert({
      where: {
        scholar_id_user_id: {
          scholar_id: scholar.scholar_id,
          user_id: userId,
        },
      },
      create: { scholar_id: scholar.scholar_id, user_id: userId },
      update: {},
    });

    // Notify
    await prisma.notifications.create({
      data: {
        user_id: userId,
        type: "NEW_SCHOLAR_SUBMISSION",
        message: scholar_id
          ? `New language version submitted for scholar ID ${scholar.scholar_id}: "${canonical_name}"`
          : `New scholar submitted: "${canonical_name}"`,
        related_entity: `scholar:${scholar.scholar_id}`,
        is_read: false,
        created_at: new Date(),
      },
    });

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

    const scholars = await prisma.scholars.findMany({
      where: {
        scholar_versions: {
          some: { status: "approved", ...languageFilter },
        },
      },
      include: {
        scholar_versions: {
          where: { status: "approved", ...languageFilter },
          orderBy: { created_at: "desc" },
          take: 1, // latest approved version in that language
          include: {
            scholar_aliases: true,
            languages: true,
          },
        },
        scholar_disciplines: {
          include: {
            disciplines: {
              include: { discipline_translations: true },
            },
          },
        },
      },
    });

    res.json({ success: true, data: scholars });
  } catch (error) {
    console.error("getPublishedScholars error:", error);
    res.status(500).json({ success: false, message: "Server error" });
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
          where: { status: "approved", ...languageFilter },
          orderBy: { created_at: "desc" },
          take: 1, // latest approved version in that language
          include: {
            scholar_aliases: true,
            languages: true,
            internal_links: {
              include: { scholars: true },
            },
          },
        },
        scholar_disciplines: {
          include: {
            disciplines: {
              include: { discipline_translations: true },
            },
          },
        },
        media: { where: { status: "approved" } },
        bibliography: true,
        comments: {
          where: { deleted_at: null },
          include: {
            users: { select: { id: true, username: true } },
          },
          orderBy: { created_at: "desc" },
        },
        scholar_contributors: {
          include: {
            users: { select: { id: true, username: true } },
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

    // Fetch all available languages for this scholar (for frontend switcher)
    const availableLanguages = await prisma.scholar_versions.findMany({
      where: { scholar_id: scholarId, status: "approved" },
      select: { languages: true },
      distinct: ["language_id"],
    });

    res.json({
      success: true,
      data: {
        ...scholar,
        available_languages: availableLanguages.map((v) => v.languages),
      },
    });
  } catch (error) {
    console.error("getScholarById error:", error);
    res.status(500).json({ success: false, message: "Server error" });
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
  } = req.body;

  try {
    const scholar = await prisma.scholars.findUnique({
      where: { scholar_id: scholarId },
    });

    if (!scholar) {
      return res.status(404).json({ success: false, message: "Scholar not found" });
    }

    // Get latest approved version to snapshot what changed
    const previousVersion = await prisma.scholar_versions.findFirst({
      where: { scholar_id: scholarId, status: "approved" },
      orderBy: { created_at: "desc" },
    });

    // Create a new pending version
    const newVersion = await prisma.scholar_versions.create({
      data: {
        scholar_id: scholarId,
        language_id: language_id || null,
        canonical_name,
        region: region || null,
        birth_date_gerogean: birth_date_gregorian || null,
        birth_date_hijri: birth_date_hijri || null,
        death_date_gerogean: death_date_gregorian || null,
        death_date_hijri: death_date_hijri || null,
        century_hijri: century_hijri || null,
        century_gregorian: century_gregorian || null,
        biography,
        status: "pending",
        created_by: userId,
        created_at: new Date(),
      },
    });

    // Save aliases for this new version
    if (aliases && aliases.length > 0) {
      await prisma.scholar_aliases.createMany({
        data: aliases.map((alias) => ({
          version_id: newVersion.version_id,
          alias_name: alias,
        })),
      });
    }

    // Store field-level revision records if caller tells us what changed
    if (previousVersion && changed_fields && changed_fields.length > 0) {
      const revisionData = changed_fields.map((field) => ({
        version_id: newVersion.version_id,
        edited_by: userId,
        field_changed: field,
        old_value: String(previousVersion[field] ?? ""),
        new_value: String(req.body[field] ?? ""),
        created_at: new Date(),
      }));

      await prisma.revisions.createMany({ data: revisionData });
    }

    // Add as contributor if not already
    await prisma.scholar_contributors.upsert({
      where: {
        scholar_id_user_id: { scholar_id: scholarId, user_id: userId },
      },
      create: { scholar_id: scholarId, user_id: userId },
      update: {},
    });

    // Notify admins
    await prisma.notifications.create({
      data: {
        user_id: userId,
        type: "EDIT_PROPOSAL",
        message: `Edit proposed for scholar ID ${scholarId} ("${canonical_name}")`,
        related_entity: `scholar_version:${newVersion.version_id}`,
        is_read: false,
        created_at: new Date(),
      },
    });

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

 