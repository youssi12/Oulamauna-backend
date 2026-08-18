const prisma = require("../config/db");
const { uploadScholarImageService } = require("../service/scholarImage.service");
const { createWorkService } = require("../service/works.service");
const { uploadMediaService } = require("../service/media.service");
const { createReferenceService } = require("../service/references.service");


const WORK_FORMATS = new Set(["BOOK","ARTICLE","TREATISE","MANUSCRIPT","LECTURE","SERMON","FATWA","POEM","LETTER","COMMENTARY","TRANSLATION","RESEARCH","COURSE","DEVICE","INVENTION","SOFTWARE","MAP","OTHER",]);
const DATE_TYPES = new Set(["birth", "death"]);
const CALENDARS = new Set(["hijri", "gregorian"]);



exports.createScholar = async (req, res) => {
  // ── Parse the JSON payload from the single "data" field ──
  // req.body.data arrives as a raw JSON string because it's multipart —
  // everything non-file lives here instead of scattered across req.body.
  let payload;
  try {
    payload = JSON.parse(req.body.data);
  } catch (err) {
    return res.status(400).json({ success: false, message: "Invalid JSON in 'data' field" });
  }
 
  const {
    scholar_id,
    canonical_name,
    aliases,
    region_id,
    century_hijri_start,
    century_hijri_end,
    century_gregorian_start,
    century_gregorian_end,
    dates,
    biography,
    language_id,
    discipline_ids,
    references,
    works, // each item may include a "file_ref" string, e.g. "work_file_0"
    media, // each item may include a "file_ref" string, e.g. "media_file_0"
  } = payload;
 
  const userId = req.user.id;
 
  // ── Build a fieldname → file lookup from multer.any() ──
  // Files are matched to array items by "file_ref", not position.
  const filesByField = {};
  (req.files || []).forEach((f) => {
    filesByField[f.fieldname] = f;
  });
 
  // ===================================================
  // 1. Required fields
  // ===================================================
   if (!canonical_name) {
  return res.status(400).json({
    success: false,
    message: "canonical_name is required",
  });
}

if (!biography) {
  return res.status(400).json({
    success: false,
    message: "biography is required",
  });
}

if (!language_id) {
  return res.status(400).json({
    success: false,
    message: "language_id is required",
  });
}
 
  // ===================================================
  // Dates — enum + range validation
  // ===================================================
  if (dates && dates.length > 0) {
    for (let i = 0; i < dates.length; i++) {
      const d = dates[i];
 
      if (!DATE_TYPES.has(d.date_type)) {
        return res.status(400).json({
          success: false,
          message: `Date #${i + 1}: date_type must be one of: ${[...DATE_TYPES].join(", ")}`,
        });
      }
 
      if (!CALENDARS.has(d.calendar)) {
        return res.status(400).json({
          success: false,
          message: `Date #${i + 1}: calendar must be one of: ${[...CALENDARS].join(", ")}`,
        });
      }
 
      if (d.raw_text != null && String(d.raw_text).length > 100) {
        return res.status(400).json({
          success: false,
          message: `Date #${i + 1}: raw_text must be 100 characters or fewer`,
        });
      }
 
      if (d.year == null) continue;
 
      const year = parseInt(d.year, 10);
 
      if (Number.isNaN(year)) {
        return res.status(400).json({
          success: false,
          message: `Date #${i + 1}: year must be a valid number`,
        });
      }
 
      if (d.calendar === "gregorian" && (year < 1 || year > 2026)) {
        return res.status(400).json({
          success: false,
          message: "Gregorian year must be between 1 and 2026.",
        });
      }
 
      if (d.calendar === "hijri" && (year < 1 || year > 1449)) {
        return res.status(400).json({
          success: false,
          message: "Hijri year must be between 1 and 1449.",
        });
      }
    }
  }
 
  // ===================================================
  // 8. Works — required fields, enum, file/url exclusivity, file_ref existence
  // ===================================================
  if (works && works.length > 0) {
    for (let i = 0; i < works.length; i++) {
      const w = works[i];
 
      if (!w.title) {
        return res.status(400).json({
          success: false,
          message: `Work #${i + 1}: title is required.`,
        });
      }
 
      if (!WORK_FORMATS.has(w.format)) {
        return res.status(400).json({
          success: false,
          message: `Work #${i + 1}: invalid format.`,
        });
      }
 
      if (w.file_ref && w.media_url) {
        return res.status(400).json({
          success: false,
          message: `Work #${i + 1}: cannot have both file and media_url.`,
        });
      }
 
      // if (!w.file_ref && !w.media_url) {
      //   return res.status(400).json({
      //     success: false,
      //     message: `Work #${i + 1}: requires either file or media_url.`,
      //   });
      // }
 
      if (w.file_ref && !filesByField[w.file_ref]) {
        return res.status(400).json({
          success: false,
          message: `Work #${i + 1}: missing uploaded file '${w.file_ref}'.`,
        });
      }
    }
  }
 
  // ===================================================
  // 9. Media — file/url exclusivity, file_ref existence
  // ===================================================
  if (media && media.length > 0) {
    for (let i = 0; i < media.length; i++) {
      const m = media[i];
 
      if (m.file_ref && m.media_url) {
        return res.status(400).json({
          success: false,
          message: `Media #${i + 1}: cannot have both file and media_url.`,
        });
      }
 
      if (!m.file_ref && !m.media_url) {
        return res.status(400).json({
          success: false,
          message: `Media #${i + 1}: requires either file or media_url.`,
        });
      }
 
      if (m.file_ref && !filesByField[m.file_ref]) {
        return res.status(400).json({
          success: false,
          message: `Media #${i + 1}: missing uploaded file '${m.file_ref}'.`,
        });
      }
    }
  }
 
  // ===================================================
  // 11. References — required fields
  // ===================================================
  if (references && references.length > 0) {
    for (let i = 0; i < references.length; i++) {
      const r = references[i];
 
      if (!r.title) {
        return res.status(400).json({
          success: false,
          message: `Reference #${i + 1}: title is required.`,
        });
      }
 
      if (!r.citation) {
        return res.status(400).json({
          success: false,
          message: `Reference #${i + 1}: citation is required.`,
        });
      }
    }
  }
 
  try {
    // ===================================================
    // 2. User permissions
    // ===================================================
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user || !user.allowed_to_contribute) {
      return res.status(403).json({ success: false, message: "You are not allowed to contribute" });
    }
 
    const parsedLanguageId = language_id ? parseInt(language_id) : null;
    const parsedRegionId = region_id ? parseInt(region_id) : null;
 
    if (language_id && Number.isNaN(parsedLanguageId)) {
      return res.status(400).json({ success: false, message: "language_id must be a valid number" });
    }
 
    if (region_id && Number.isNaN(parsedRegionId)) {
      return res.status(400).json({ success: false, message: "region_id must be a valid number" });
    }
 
    // ===================================================
    // 6. Language exists
    // ===================================================
    if (parsedLanguageId) {
      const language = await prisma.languages.findUnique({
        where: { language_id: parsedLanguageId },
      });
 
      if (!language) {
        return res.status(400).json({ success: false, message: "Invalid language." });
      }
    }
 
    // ===================================================
    // 5. Region exists — and belongs to the same language
    // ===================================================
    if (parsedRegionId) {
      const region = await prisma.regions.findUnique({
        where: { region_id: parsedRegionId },
      });
 
      if (!region) {
        return res.status(400).json({ success: false, message: "Invalid region." });
      }
 
      if (parsedLanguageId && region.language_id !== parsedLanguageId) {
        return res.status(400).json({
          success: false,
          message: "region_id does not belong to the given language_id.",
        });
      }
    }
 
    // ===================================================
    // 7. Disciplines exist
    // ===================================================
    if (discipline_ids && discipline_ids.length > 0) {
      const found = await prisma.disciplines.findMany({
        where: { discipline_id: { in: discipline_ids } },
      });
 
      if (found.length !== discipline_ids.length) {
        return res.status(400).json({
          success: false,
          message: "One or more disciplines are invalid.",
        });
      }
    }
 
    // ===================================================
    // 3 & 4. Existing scholar / language version
    // ===================================================
    let existingScholar = null;
    if (scholar_id) {
      existingScholar = await prisma.scholars.findUnique({
        where: { scholar_id: parseInt(scholar_id) },
      });
 
      if (!existingScholar) {
        return res.status(404).json({ success: false, message: "Scholar not found" });
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
 
    // ===================================================
    // Validation complete — proceed to create everything
    // ===================================================
    const { scholar, version } = await prisma.$transaction(async (tx) => {
      const scholar = existingScholar
        ? existingScholar
        : await tx.scholars.create({
            data: { created_by: userId, created_at: new Date() },
          });
 
      const version = await tx.scholar_versions.create({
        data: {
          scholar_id: scholar.scholar_id,
          language_id: parsedLanguageId,
          canonical_name,
          region_id: parsedRegionId,
          century_hijri_start: century_hijri_start ? parseInt(century_hijri_start) : null,
          century_hijri_end: century_hijri_end ? parseInt(century_hijri_end) : null,
          century_gregorian_start: century_gregorian_start ? parseInt(century_gregorian_start) : null,
          century_gregorian_end: century_gregorian_end ? parseInt(century_gregorian_end) : null,
          biography,
          version_type: "creation",
          status: "pending",
          created_by: userId,
          created_at: new Date(),
        },
      });
 
      if (aliases && aliases.length > 0) {
        await tx.scholar_aliases.createMany({
          data: aliases.map((alias) => ({ version_id: version.version_id, alias_name: alias })),
        });
      }
 
      if (dates && dates.length > 0) {
        await tx.scholar_dates.createMany({
          data: dates.map((d) => ({
            version_id: version.version_id,
            date_type: d.date_type,
            calendar: d.calendar,
            year: d.year ? parseInt(d.year) : null,
            is_approximate: !!d.is_approximate,
            raw_text: d.raw_text || null,
          })),
        });
      }
 
      // CHANGED: disciplines are now version-scoped, like aliases/dates —
      // they used to live on `scholar_id` and were only written on first
      // creation (`!scholar_id`). A discipline tag is language/version
      // content (a French version of a scholar can be tagged differently
      // than the Arabic one), so it's written on every submission now,
      // not gated behind "only if this is a brand new scholar".
      if (discipline_ids && discipline_ids.length > 0) {
        await tx.scholar_disciplines.createMany({
          data: discipline_ids.map((did) => ({ version_id: version.version_id, discipline_id: did })),
          skipDuplicates: true,
        });
      }
 
      await tx.scholar_contributors.upsert({
        where: { scholar_id_user_id: { scholar_id: scholar.scholar_id, user_id: userId } },
        create: { scholar_id: scholar.scholar_id, user_id: userId },
        update: {},
      });
 
      return { scholar, version };
    });
 
    // ──────────────────────────────────────────────────────────────
    // Post-transaction: image / works / media / references
    // NOTE: these services still do the Cloudinary upload AND the DB
    // write in a single call. Full doc-7 architecture (upload all
    // files, then one transaction) would require splitting each
    // service into an "upload" step and a "write" step — not done
    // here since those service files weren't provided. Because every
    // input was validated above, none of these calls should fail on
    // bad input anymore — only on infra issues (e.g. Cloudinary down).
    // ──────────────────────────────────────────────────────────────
    const sideEffectErrors = [];
 
    // ── Profile image ──
    // FIX: uploadScholarImageService now writes to the independent
    // img_versions table and requires `uploaded_by` (it throws
    // "uploaded_by is required" without it). That was missing here,
    // which meant every scholar-creation-with-image call silently
    // failed and got swallowed into `sideEffectErrors` below — the
    // scholar was created but the image never attached, with no loud
    // error anywhere. Added `uploaded_by: userId` to fix that.
    let imageResult = null;
    const imageFile = filesByField["image"];
    if (imageFile) {
      try {
        imageResult = await uploadScholarImageService({
          version_id: version.version_id,
          file: imageFile,
          uploaded_by: userId,
        });
      } catch (err) {
        sideEffectErrors.push({ type: "image", message: err.message });
      }
    }
 
    // ── Works ──
    const workResults = [];
    if (works && works.length > 0) {
      for (let i = 0; i < works.length; i++) {
        const w = works[i];
        try {
          const file = w.file_ref ? filesByField[w.file_ref] : undefined;
          const created = await createWorkService({
            version_id: version.version_id,
            title: w.title,
            year: w.year,
            format: w.format,
            description: w.description,
            media_url: w.media_url,
            created_by:userId,
            file,
          });
          workResults.push(created);
        } catch (err) {
          sideEffectErrors.push({ type: "work", index: i, message: err.message });
        }
      }
    }
 
    // ── Media ──
    const mediaResults = [];
    if (media && media.length > 0) {
      for (let i = 0; i < media.length; i++) {
        const m = media[i];
        try {
          const file = m.file_ref ? filesByField[m.file_ref] : undefined;
          const created = await uploadMediaService({
            version_id: version.version_id,
            title: m.title,
            year: m.year,
            description: m.description,
            media_url: m.media_url,
            file,
            userId,
          });
          mediaResults.push(created);
        } catch (err) {
          sideEffectErrors.push({ type: "media", index: i, message: err.message });
        }
      }
    }
 
    // ── References ──
    const referenceResults = [];
    if (references && references.length > 0) {
      for (let i = 0; i < references.length; i++) {
        const r = references[i];
        try {
          const created = await createReferenceService({
            version_id: version.version_id,
            title: r.title,
            citation: r.citation,
            created_by:userId,
            url: r.url,
          });
          referenceResults.push(created);
        } catch (err) {
          sideEffectErrors.push({ type: "reference", index: i, message: err.message });
        }
      }
    }
 
    const admins = await prisma.users.findMany({
      where: { roles: { role_name: "admin" } },
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
 
    // FIX: `data.version` used to be `imageResult || version`. That
    // worked when uploadScholarImageService returned a scholar_versions
    // row, but it now returns an img_versions row instead (different
    // shape entirely — img_version_id/image_url/status/uploaded_by,
    // not canonical_name/biography/etc). Whether an image file was
    // attached used to silently change the shape of `data.version` —
    // `version` is now always the scholar_versions row, and the image
    // submission (if any) gets its own `image` key.
    res.status(201).json({
      success: true,
      message: scholar_id ? "New language version submitted for review" : "Scholar submitted for review",
      data: {
        scholar,
        version,
        image: imageResult || null,
        works: workResults,
        media: mediaResults,
        references: referenceResults,
      },
      warnings: sideEffectErrors.length > 0 ? sideEffectErrors : undefined,
    });
  } catch (error) {
    console.error("createScholar error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 


exports.getPublishedScholars = async (req, res) => {
  const {
    lang, // Removed the default "1" so we can check if it's an ID or a code
    region,
    century,
    century_calendar = "gregorian",
    discipline,
  } = req.query;

  try {
    // 1. Safely find the language (handles both ID and Code)
    let languageWhere = {};
    
    if (lang) {
      const parsedLang = Number(lang);
      // If it's a valid number, search by ID. Otherwise, search by code.
      if (!isNaN(parsedLang)) {
        languageWhere.language_id = parsedLang;
      } else {
        languageWhere.code = lang; 
      }
    } else {
      // Default to language_id 1 if nothing is passed in the URL
      languageWhere.language_id = 1; 
    }

    const language = await prisma.languages.findFirst({
      where: languageWhere,
    });

    if (!language) {
      return res.status(404).json({
        success: false,
        message: `Language '${lang || 'default'}' not found`,
      });
    }

    // 2. Build the filters
    const versionWhere = {
      status: "approved",
      language_id: language.language_id,
    };

    if (region) {
      versionWhere.region_id = {
        in: region.split(",").map(Number),
      };
    }

    if (century) {
      const c = parseInt(century);

      if (century_calendar === "hijri") {
        versionWhere.century_hijri_start = { lte: c };
        versionWhere.century_hijri_end = { gte: c };
      } else {
        versionWhere.century_gregorian_start = { lte: c };
        versionWhere.century_gregorian_end = { gte: c };
      }
    }

    // CHANGED: discipline now filters on the version (scholar_disciplines
    // is keyed by version_id), not on the scholar directly — a discipline
    // tag can differ per language version, so it has to be part of
    // versionWhere, same as region/century.
    if (discipline) {
      versionWhere.scholar_disciplines = {
        some: {
          discipline_id: {
            in: discipline.split(",").map(Number),
          },
        },
      };
    }

    const scholarWhere = {
      scholar_versions: {
        some: versionWhere,
      },
    };

    // 3. Fetch scholars
    const scholars = await prisma.scholars.findMany({
      where: scholarWhere,
      include: {
        scholar_versions: {
          where: versionWhere,
          orderBy: { created_at: "desc" },
          take: 1,
          include: {
            scholar_aliases: true,
            languages: true,
            regions: true,
            scholar_dates: true,
            scholar_references: { where: { status: "approved" } },
media: {
  where: { status: "approved" },
  include: { users: { select: { id: true, username: true } } },
},
scholar_works: {
  where: { status: "approved" },
  include: { users: { select: { id: true, username: true } } },
},
            scholar_disciplines: { include: { disciplines: true } },
          },
        },
      },
    });

    // 4. Mask unapproved images
    const shaped = scholars.map((scholar) => {
      const version = scholar.scholar_versions[0];
      if (version && version.image_status !== "approved") {
        version.image_url = null;
      }
      return scholar;
    });

    return res.json({
      success: true,
      count: shaped.length,
      data: shaped,
    });
  } catch (error) {
    console.error("getPublishedScholars error:", error);

    return res.status(500).json({
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
            regions: true,
            scholar_dates: true,
            // FIX: media belongs to scholar_versions, not scholars —
            // it was previously included at the wrong level, which
            // would throw a Prisma "unknown field" error.
            media: {
  where: { status: "approved" },
  include: {
    users: { select: { id: true, username: true } },
  },
},
            internal_links: {
              include: {
                scholars: true,
              },
            },
            // CHANGED: disciplines moved here — now version-scoped,
            // same reasoning as works/media/references.
            scholar_disciplines: {
              include: {
                disciplines: true,
              },
            },
            // CHANGED: comments moved here — each version now has its
            // own comment thread instead of sharing one across every
            // language version of a scholar.
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
          },
        },

        bibliography: true,

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
    scholars_scholar_relationships_related_scholar_idToscholars: {
      include: {
       
        scholar_versions: {
          where: { status: "approved" },
          orderBy: { created_at: "desc" },
          select: {
            canonical_name: true,
            languages: { select: { code: true } },
          },
        },
      },
    },
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

    // ── Mask an unapproved image — image_url/image_status are scalar
    // columns on scholar_versions, not a related table, so they can't
    // be filtered via `where` inside the include like media/works/refs. ──
    // NOTE: still correct under img_versions, same reasoning as above.
    if (currentVersion.image_status !== "approved") {
      currentVersion.image_url = null;
    }

    // References for this version — FIX: added status:"approved" filter.
    // This was previously unfiltered, so pending/rejected references
    // were leaking into a public endpoint.
    const references = await prisma.scholar_references.findMany({
      where: {
        version_id: currentVersion.version_id,
        status: "approved",
      },
      orderBy: {
        reference_id: "asc",
      },
    });

    // Works for this version — FIX: same missing filter as references.
    const works = await prisma.scholar_works.findMany({
  where: {
    version_id: currentVersion.version_id,
    status: "approved",
  },
  include: {
    users: { select: { id: true, username: true } },
  },
  orderBy: {
    year: "desc",
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
        works,
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
    region_id,
    century_hijri_start,
    century_hijri_end,
    century_gregorian_start,
    century_gregorian_end,
    biography,
    discipline_ids,
    language_id = 1,
  } = req.body;
  
  if (!canonical_name) {
    return res.status(400).json({
      success: false,
      message: "canonical_name is required",
    });
  }

  try {
    // --------------------------------------------------
    // 1. Check contributor permission
    // --------------------------------------------------

    const user = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user || !user.allowed_to_contribute) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to contribute",
      });
    }

    // --------------------------------------------------
    // 2. Check scholar exists
    // --------------------------------------------------

    const scholar = await prisma.scholars.findUnique({
      where: { scholar_id: scholarId },
    });

    if (!scholar) {
      return res.status(404).json({
        success: false,
        message: "Scholar not found",
      });
    }

    const parsedLanguageId = parseInt(language_id);

    // --------------------------------------------------
    //? 3. Prevent duplicate pending edit
   

    // const existingPending = await prisma.scholar_versions.findFirst({
    //   where: {
    //     scholar_id: scholarId,
    //     language_id: parsedLanguageId,
    //     status: "pending",
    //     version_type: "edition",
    //   },
    // });

    // if (existingPending) {
    //   return res.status(400).json({
    //     success: false,
    //     message:
    //       "A pending edit already exists for this scholar in this language",
    //   });
    // }

  // --------------------------------------------------

    // --------------------------------------------------
    // 4. Get the CURRENT APPROVED VERSION
    //    Used only as a fallback source for fields the
    //    contributor didn't send, and for aliases/disciplines.
    //    NOT used to clone media/works/references/dates/comments —
    //    those stay on the approved version until this
    //    edit is approved, at which point approveScholar()
    //    reassigns them (see approveScholar).
    // --------------------------------------------------

    const previousVersion = await prisma.scholar_versions.findFirst({
      where: {
        scholar_id: scholarId,
        language_id: parsedLanguageId,
        status: "approved",
      },
      include: {
        scholar_aliases: true,
        // CHANGED: needed so we can carry forward the discipline set
        // when the contributor doesn't send a replacement list.
        scholar_disciplines: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    if (!previousVersion) {
      return res.status(404).json({
        success: false,
        message:
          "No approved version exists for this scholar in this language",
      });
    }

    // --------------------------------------------------
    // 5. Decide which values to use
    //
    // If frontend sends a value -> use the new value.
    // Otherwise -> keep the old approved value.
    // --------------------------------------------------

    const finalCanonicalName =
      canonical_name ?? previousVersion.canonical_name;

    const finalRegionId =
      region_id !== undefined
        ? (region_id === null ? null : parseInt(region_id))
        : previousVersion.region_id;

    const finalHijriStart =
      century_hijri_start !== undefined
        ? (century_hijri_start === null ? null : parseInt(century_hijri_start))
        : previousVersion.century_hijri_start;

    const finalHijriEnd =
      century_hijri_end !== undefined
        ? (century_hijri_end === null ? null : parseInt(century_hijri_end))
        : previousVersion.century_hijri_end;

    const finalGregorianStart =
      century_gregorian_start !== undefined
        ? (century_gregorian_start === null ? null : parseInt(century_gregorian_start))
        : previousVersion.century_gregorian_start;

    const finalGregorianEnd =
      century_gregorian_end !== undefined
        ? (century_gregorian_end === null ? null : parseInt(century_gregorian_end))
        : previousVersion.century_gregorian_end;

    const finalBiography =
      biography !== undefined ? biography : previousVersion.biography;

    // --------------------------------------------------
    // 6. Aliases — the one piece of "related data" that
    //    still lives on scholar_versions (language-specific
    //    text, same category as canonical_name/biography).
    //    If frontend sends the array -> use the new array.
    //    If not -> carry forward the old names.
    // --------------------------------------------------

    const finalAliases =
      aliases !== undefined
        ? aliases
        : previousVersion.scholar_aliases.map((a) => a.alias_name);

    // --------------------------------------------------
    // 6b. Disciplines — same pattern as aliases now that they're
    //     version-scoped. If frontend sends discipline_ids -> use
    //     the new list. If not -> carry forward the old tags.
    // --------------------------------------------------

    const finalDisciplineIds =
      discipline_ids !== undefined
        ? discipline_ids
        : previousVersion.scholar_disciplines.map((d) => d.discipline_id);

    if (finalDisciplineIds.length > 0) {
      const found = await prisma.disciplines.findMany({
        where: { discipline_id: { in: finalDisciplineIds } },
      });

      if (found.length !== finalDisciplineIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more disciplines are invalid.",
        });
      }
    }

    // --------------------------------------------------
    // 7. Create the pending edition
    //    scholar_versions + scholar_aliases + scholar_disciplines
    //    are written here. No media/works/references/dates/comments
    //    are touched or cloned.
    // --------------------------------------------------

    const newVersion = await prisma.$transaction(async (tx) => {
      const version = await tx.scholar_versions.create({
        data: {
          scholar_id: scholarId,
          language_id: parsedLanguageId,

          canonical_name: finalCanonicalName,
          region_id: finalRegionId,

          century_hijri_start: finalHijriStart,
          century_hijri_end: finalHijriEnd,

          century_gregorian_start: finalGregorianStart,
          century_gregorian_end: finalGregorianEnd,

          biography: finalBiography,

          // FIX: previously copied previousVersion.image_url/image_status
          // here as a one-time snapshot at edit-submission time. Under the
          // img_versions design, scholar_versions.image_url is supposed to
          // always reflect "whichever img_versions proposal is currently
          // approved" — but a snapshot taken now goes stale the moment
          // someone gets a *new* image proposal approved against the old
          // (still-live) previousVersion while this edit sits pending,
          // since that approval writes to previousVersion's row, not this
          // one. Deliberately leaving image_url/image_status/
          // image_uploaded_by unset here (null) rather than copying a
          // value that can silently rot. This pending edition has no
          // public visibility anyway (only approved versions are ever
          // read), so there's nothing lost by leaving it empty in the
          // meantime.
          //
          // REQUIRED: approveScholar() must, at the moment THIS edition is
          // approved, re-read previousVersion's live image_url/
          // image_status/image_uploaded_by (fresh query, not a cached
          // value) and copy those onto this version then — the same way
          // it presumably reassigns works/media/references/dates. That
          // guarantees whatever image was actually approved-and-current
          // on the old version at approval time is what carries over,
          // regardless of when it was approved relative to this edit.

          version_type: "edition",
          status: "pending",

          created_by: userId,
          created_at: new Date(),
        },
      });

      if (finalAliases.length > 0) {
        await tx.scholar_aliases.createMany({
          data: finalAliases.map((alias) => ({
            version_id: version.version_id,
            alias_name: typeof alias === "string" ? alias : alias.alias_name,
          })),
        });
      }

      // CHANGED: write disciplines onto the new pending version, same
      // pattern as aliases above.
      if (finalDisciplineIds.length > 0) {
        await tx.scholar_disciplines.createMany({
          data: finalDisciplineIds.map((did) => ({
            version_id: version.version_id,
            discipline_id: did,
          })),
          skipDuplicates: true,
        });
      }

      await tx.scholar_contributors.upsert({
        where: {
          scholar_id_user_id: {
            scholar_id: scholarId,
            user_id: userId,
          },
        },
        create: {
          scholar_id: scholarId,
          user_id: userId,
        },
        update: {},
      });

      return version;
    });

    // --------------------------------------------------
    // 8. Notify admins
    // --------------------------------------------------

    const admins = await prisma.users.findMany({
      where: {
        roles: {
          role_name: "admin",
        },
      },
      select: {
        id: true,
      },
    });

    if (admins.length > 0) {
      await prisma.notifications.createMany({
        data: admins.map((admin) => ({
          user_id: admin.id,
          type: "EDIT_PROPOSAL",
          message: `Edit proposed for scholar ID ${scholarId} ("${finalCanonicalName}")`,
          related_entity: `scholar_version:${newVersion.version_id}`,
          is_read: false,
          created_at: new Date(),
        })),
      });
    }

    // --------------------------------------------------
    // 9. Response
    // --------------------------------------------------

    res.json({
      success: true,
      message: "Edit submitted for review",
      data: newVersion,
    });

  } catch (error) {
    console.error("editScholar error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getMySubmissions = async (req, res) => {
  const userId = req.user.id;

  try {
    // FIX: added img_versions to the Promise.all — images are now their
    // own independently-tracked submission (own uploaded_by + status),
    // same category as works/media/references, so they belong on the
    // contributor's own dashboard too. Previously omitted entirely,
    // meaning a contributor had no way to see their pending/rejected
    // image submissions here.
    const [versions, works, media, references, images] = await Promise.all([
      prisma.scholar_versions.findMany({
        where: { created_by: userId },
        include: { scholars: true, languages: true },
        orderBy: { created_at: "desc" },
      }),
      prisma.scholar_works.findMany({
        where: { created_by: userId },
        include: { scholar_versions: { include: { scholars: true } } },
        orderBy: { work_id: "desc" },
      }),
      prisma.media.findMany({
        where: { uploaded_by: userId },
        include: { scholar_versions: { include: { scholars: true } } },
        orderBy: { uploaded_at: "desc" },
      }),
      prisma.scholar_references.findMany({
        where: { created_by: userId },
        include: { scholar_versions: { include: { scholars: true } } },
        orderBy: { reference_id: "desc" },
      }),
      prisma.img_versions.findMany({
        where: { uploaded_by: userId },
        include: { scholar_versions: { include: { scholars: true } } },
        orderBy: { created_at: "desc" },
      }),
    ]);

    res.json({
      success: true,
      data: {
        scholar_versions: versions,
        works,
        media,
        references,
        images,
      },
    });
  } catch (error) {
    console.error("getMySubmissions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getScholarByName = async (req, res) => {
  const {
    q,
    lang = "ar",
  } = req.query;

  if (!q) {
    return res.status(400).json({
      success: false,
      message: "Search query is required",
    });
  }

  try {
    // Requested language
    const requestedLanguage = await prisma.languages.findFirst({
      where: {
        code: lang,
      },
    });

    // ---------------------------------
    // Search by canonical name or alias
    // ---------------------------------

    const matchedVersion = await prisma.scholar_versions.findFirst({
      where: {
        status: "approved",
        OR: [
          {
            canonical_name: {
              contains: q,
            },
          },
          {
            scholar_aliases: {
              some: {
                alias_name: {
                  contains: q,
                },
              },
            },
          },
        ],
      },
      include: {
        scholar_aliases: true,
      },
    });

    if (!matchedVersion) {
      return res.status(404).json({
        success: false,
        message: "Scholar not found",
      });
    }

    // ---------------------------------
    // Try requested language first
    // ---------------------------------

    let version = null;

    if (requestedLanguage) {
      version = await prisma.scholar_versions.findFirst({
        where: {
          scholar_id: matchedVersion.scholar_id,
          language_id: requestedLanguage.language_id,
          status: "approved",
        },
      });
    }

    // ---------------------------------
    // Fallback to any approved language
    // ---------------------------------

    if (!version) {
      version = await prisma.scholar_versions.findFirst({
        where: {
          scholar_id: matchedVersion.scholar_id,
          status: "approved",
        },
        orderBy: {
          created_at: "asc",
        },
      });
    }

    if (!version) {
      return res.status(404).json({
        success: false,
        message: "No approved version found",
      });
    }

    // ---------------------------------
    // Return full scholar
    // ---------------------------------

    const scholar = await prisma.scholars.findUnique({
      where: {
        scholar_id: version.scholar_id,
      },
      include: {
        scholar_versions: {
          where: {
            version_id: version.version_id,
          },
          include: {
            scholar_aliases: true,
            // FIX: added status:"approved" filters — these were
            // previously unfiltered (scholar_references: true /
            // scholar_works: true), leaking pending/rejected items.
            scholar_references: {
              where: { status: "approved" },
            },
            scholar_works: {
  where: { status: "approved" },
  include: { users: { select: { id: true, username: true } } },
},
            
            
            media: {
              where: { status: "approved" },
              include: { users: { select: { id: true, username: true } } },
            },
            languages: true,
            regions: true,
            scholar_dates: true,
            // CHANGED: disciplines moved here — version-scoped now.
            scholar_disciplines: {
              include: {
                disciplines: true,
              },
            },
            // CHANGED: comments moved here — each version has its own
            // thread now instead of one shared across all languages.
            comments: {
              where: { deleted_at: null },
              include: {
                users: {
                  select: { id: true, username: true },
                },
              },
              orderBy: { created_at: "desc" },
            },
          },
        },
      },
    });

    // ── Mask an unapproved image on the returned version, same reason
    // as getScholarById — image_url/image_status are scalar columns,
    // not a related table, so they can't be filtered via `where`. ──
    const returnedVersion = scholar?.scholar_versions?.[0];
    if (returnedVersion && returnedVersion.image_status !== "approved") {
      returnedVersion.image_url = null;
    }

    return res.json({
      success: true,
      data: scholar,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};