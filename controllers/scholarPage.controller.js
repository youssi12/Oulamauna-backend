const prisma = require("../config/db");
const { uploadScholarImageService } = require("../service/scholarImage.service");
const { createWorkService } = require("../service/works.service");
const { uploadMediaService } = require("../service/media.service");
const { createReferenceService } = require("../service/references.service");


const WORK_FORMATS = new Set(["BOOK","ARTICLE","TREATISE","MANUSCRIPT","LECTURE","SERMON","FATWA","POEM","LETTER","COMMENTARY","TRANSLATION","RESEARCH","COURSE","DEVICE","INVENTION","SOFTWARE","MAP","OTHER",]);
const DATE_TYPES = new Set(["birth", "death"]);
const CALENDARS = new Set(["hijri", "gregorian"]);



exports.createScholar = async (req, res) => {
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
    works,
    media,
    relationships,
  } = payload;
 
  const userId = req.user.id;
  const filesByField = {};
  (req.files || []).forEach((f) => { filesByField[f.fieldname] = f; });
 
  if (!canonical_name) return res.status(400).json({ success: false, message: "canonical_name is required" });
  if (!biography) return res.status(400).json({ success: false, message: "biography is required" });
  if (!language_id) return res.status(400).json({ success: false, message: "language_id is required" });
 
  if (dates && dates.length > 0) {
    for (let i = 0; i < dates.length; i++) {
      const d = dates[i];
      if (!DATE_TYPES.has(d.date_type)) return res.status(400).json({ success: false, message: `Date #${i + 1}: date_type must be one of: ${[...DATE_TYPES].join(", ")}` });
      if (!CALENDARS.has(d.calendar)) return res.status(400).json({ success: false, message: `Date #${i + 1}: calendar must be one of: ${[...CALENDARS].join(", ")}` });
      if (d.raw_text != null && String(d.raw_text).length > 100) return res.status(400).json({ success: false, message: `Date #${i + 1}: raw_text must be 100 characters or fewer` });
      if (d.year == null) continue;
      const year = parseInt(d.year, 10);
      if (Number.isNaN(year)) return res.status(400).json({ success: false, message: `Date #${i + 1}: year must be a valid number` });
      if (d.calendar === "gregorian" && (year < 1 || year > 2026)) return res.status(400).json({ success: false, message: "Gregorian year must be between 1 and 2026." });
      if (d.calendar === "hijri" && (year < 1 || year > 1449)) return res.status(400).json({ success: false, message: "Hijri year must be between 1 and 1449." });
    }
  }
 
  if (works && works.length > 0) {
    for (let i = 0; i < works.length; i++) {
      const w = works[i];
      if (!w.title) return res.status(400).json({ success: false, message: `Work #${i + 1}: title is required.` });
      if (!WORK_FORMATS.has(w.format)) return res.status(400).json({ success: false, message: `Work #${i + 1}: invalid format.` });
      if (w.file_ref && w.media_url) return res.status(400).json({ success: false, message: `Work #${i + 1}: cannot have both file and media_url.` });
      if (w.file_ref && !filesByField[w.file_ref]) return res.status(400).json({ success: false, message: `Work #${i + 1}: missing uploaded file '${w.file_ref}'.` });
    }
  }
 
  if (media && media.length > 0) {
    for (let i = 0; i < media.length; i++) {
      const m = media[i];
      if (m.file_ref && m.media_url) return res.status(400).json({ success: false, message: `Media #${i + 1}: cannot have both file and media_url.` });
      if (!m.file_ref && !m.media_url) return res.status(400).json({ success: false, message: `Media #${i + 1}: requires either file or media_url.` });
      if (m.file_ref && !filesByField[m.file_ref]) return res.status(400).json({ success: false, message: `Media #${i + 1}: missing uploaded file '${m.file_ref}'.` });
    }
  }
 
  if (references && references.length > 0) {
    for (let i = 0; i < references.length; i++) {
      const r = references[i];
      if (!r.title) return res.status(400).json({ success: false, message: `Reference #${i + 1}: title is required.` });
      if (!r.citation) return res.status(400).json({ success: false, message: `Reference #${i + 1}: citation is required.` });
    }
  }

  // ===================================================
  // Relationships — Comprehensive Validation
  // ===================================================
  let validatedRelationships = [];
  if (relationships && relationships.length > 0) {
    const currentScholarId = scholar_id ? parseInt(scholar_id) : null;
    const relatedVersionIds = [...new Set(relationships.map(r => parseInt(r.related_version_id)))];
    
    const relatedVersions = await prisma.scholar_versions.findMany({
      where: { version_id: { in: relatedVersionIds } },
      select: { version_id: true, scholar_id: true, canonical_name: true },
    });

    let existingDirect = new Set();
    let existingInverse = new Set();
    
    if (currentScholarId) {
      const existingApprovedVersion = await prisma.scholar_versions.findFirst({
        where: { scholar_id: currentScholarId, status: "approved" },
        include: { scholar_relationships_as_source: true }
      });
      if (existingApprovedVersion) {
        for (const rel of existingApprovedVersion.scholar_relationships_as_source) {
          existingDirect.add(`${rel.related_version_id}-${rel.relation_type}`);
          const invType = rel.relation_type === 'teacher' ? 'student' : 'teacher';
          existingInverse.add(`${rel.related_version_id}-${invType}`);
        }
      }
    }

    const seenInRequest = new Set();
    for (let i = 0; i < relationships.length; i++) {
      const rel = relationships[i];
      const targetVId = parseInt(rel.related_version_id);
      const type = rel.relation_type;
      const key = `${targetVId}-${type}`;

      if (!targetVId) return res.status(400).json({ success: false, message: `Relationship #${i + 1}: related_version_id is required.` });
      if (!["teacher", "student"].includes(type)) return res.status(400).json({ success: false, message: `Relationship #${i + 1}: relation_type must be 'teacher' or 'student'.` });

      const targetScholar = relatedVersions.find(v => v.version_id === targetVId);
      if (!targetScholar) return res.status(400).json({ success: false, message: `Relationship #${i + 1}: related_version_id not found.` });

      // 1. Prevent self-relation
      if (currentScholarId && targetScholar.scholar_id === currentScholarId) {
        return res.status(400).json({ success: false, message: `Relationship #${i + 1}: A scholar cannot have a relationship with themselves.` });
      }
      // 2. Prevent duplicates within the same request
      if (seenInRequest.has(key)) continue;
      seenInRequest.add(key);
      // 3. Prevent adding relationships that already exist
      if (existingDirect.has(key)) {
        return res.status(400).json({ success: false, message: `Relationship already exists: ${targetScholar.canonical_name} is already your ${type}.` });
      }
      // 4. Prevent bidirectional conflicts
      if (existingInverse.has(key)) {
        const invType = type === 'teacher' ? 'student' : 'teacher';
        return res.status(400).json({ success: false, message: `Bidirectional conflict: ${targetScholar.canonical_name} is already recorded as your ${invType}.` });
      }

      validatedRelationships.push(rel);
    }
  }
 
  try {
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user || !user.allowed_to_contribute) return res.status(403).json({ success: false, message: "You are not allowed to contribute" });
 
    const parsedLanguageId = language_id ? parseInt(language_id) : null;
    const parsedRegionId = region_id ? parseInt(region_id) : null;
 
    if (language_id && Number.isNaN(parsedLanguageId)) return res.status(400).json({ success: false, message: "language_id must be a valid number" });
    if (region_id && Number.isNaN(parsedRegionId)) return res.status(400).json({ success: false, message: "region_id must be a valid number" });
 
    if (parsedLanguageId) {
      const language = await prisma.languages.findUnique({ where: { language_id: parsedLanguageId } });
      if (!language) return res.status(400).json({ success: false, message: "Invalid language." });
    }
 
    if (parsedRegionId) {
      const region = await prisma.regions.findUnique({ where: { region_id: parsedRegionId } });
      if (!region) return res.status(400).json({ success: false, message: "Invalid region." });
      if (parsedLanguageId && region.language_id !== parsedLanguageId) {
        return res.status(400).json({ success: false, message: "region_id does not belong to the given language_id." });
      }
    }
 
    if (discipline_ids && discipline_ids.length > 0) {
      const found = await prisma.disciplines.findMany({ where: { discipline_id: { in: discipline_ids } } });
      if (found.length !== discipline_ids.length) return res.status(400).json({ success: false, message: "One or more disciplines are invalid." });
    }
 
    let existingScholar = null;
    if (scholar_id) {
      existingScholar = await prisma.scholars.findUnique({ where: { scholar_id: parseInt(scholar_id) } });
      if (!existingScholar) return res.status(404).json({ success: false, message: "Scholar not found" });
      if (parsedLanguageId) {
        const existingVersion = await prisma.scholar_versions.findFirst({
          where: { scholar_id: parseInt(scholar_id), language_id: parsedLanguageId, status: "approved" },
        });
        if (existingVersion) return res.status(400).json({ success: false, message: "An approved version in this language already exists for this scholar" });
      }
    }
 
    const { scholar, version } = await prisma.$transaction(async (tx) => {
      const scholar = existingScholar ? existingScholar : await tx.scholars.create({ data: { created_by: userId, created_at: new Date() } });
 
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
        await tx.scholar_aliases.createMany({ data: aliases.map((alias) => ({ version_id: version.version_id, alias_name: alias })) });
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

      // Insert validated relationships
      if (validatedRelationships && validatedRelationships.length > 0) {
        for (const rel of validatedRelationships) {
          await tx.scholar_relationships.create({
            data: {
              version_id: version.version_id,
              related_version_id: parseInt(rel.related_version_id),
              relation_type: rel.relation_type,
            },
          });
        }
      }
      return { scholar, version };
    });
 
    const sideEffectErrors = [];
    let imageResult = null;
    const imageFile = filesByField["image"];
    if (imageFile) {
      try {
        imageResult = await uploadScholarImageService({ version_id: version.version_id, file: imageFile, uploaded_by: userId });
        // Write directly onto scholar_versions instead of img_versions
        await prisma.scholar_versions.update({
          where: { version_id: version.version_id },
          data: {
            image_url: imageResult.image_url,
            image_status: "pending",
            image_uploaded_by: userId,
          },
        });
      } catch (err) {
        sideEffectErrors.push({ type: "image", message: err.message });
      }
    }
 
    const workResults = [];
    if (works && works.length > 0) {
      for (let i = 0; i < works.length; i++) {
        const w = works[i];
        try {
          const file = w.file_ref ? filesByField[w.file_ref] : undefined;
          const created = await createWorkService({ version_id: version.version_id, title: w.title, year: w.year, format: w.format, description: w.description, media_url: w.media_url, created_by: userId, file });
          workResults.push(created);
        } catch (err) {
          sideEffectErrors.push({ type: "work", index: i, message: err.message });
        }
      }
    }
 
    const mediaResults = [];
    if (media && media.length > 0) {
      for (let i = 0; i < media.length; i++) {
        const m = media[i];
        try {
          const file = m.file_ref ? filesByField[m.file_ref] : undefined;
          const created = await uploadMediaService({ version_id: version.version_id, title: m.title, year: m.year, description: m.description, media_url: m.media_url, file, userId });
          mediaResults.push(created);
        } catch (err) {
          sideEffectErrors.push({ type: "media", index: i, message: err.message });
        }
      }
    }
 
    const referenceResults = [];
    if (references && references.length > 0) {
      for (let i = 0; i < references.length; i++) {
        const r = references[i];
        try {
          const created = await createReferenceService({ version_id: version.version_id, title: r.title, citation: r.citation, created_by: userId, url: r.url });
          referenceResults.push(created);
        } catch (err) {
          sideEffectErrors.push({ type: "reference", index: i, message: err.message });
        }
      }
    }
 
    const admins = await prisma.users.findMany({ where: { roles: { role_name: "admin" } }, select: { id: true } });
    if (admins.length > 0) {
      await prisma.notifications.createMany({
        data: admins.map((admin) => ({
          user_id: admin.id,
          type: "NEW_SCHOLAR_SUBMISSION",
          message: scholar_id ? `New language version submitted for scholar ID ${scholar.scholar_id}: "${canonical_name}"` : `New scholar submitted: "${canonical_name}"`,
          related_entity: `scholar:${scholar.scholar_id}`,
          is_read: false,
          created_at: new Date(),
        })),
      });
    }
 
    res.status(201).json({
      success: true,
      message: scholar_id ? "New language version submitted for review" : "Scholar submitted for review",
      data: { scholar, version, image: imageResult || null, works: workResults, media: mediaResults, references: referenceResults },
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


// ============================================================
// DRAFT SYSTEM — saveDraft / getMyDrafts / getDraftById / deleteDraft
// No files here (portrait, work files, media files stay in
// localStorage only until final submit — see explanation given earlier).
// Body is plain JSON, NOT multipart — no uploadScholarBundle.any() on this route.
// ============================================================

exports.saveDraft = async (req, res) => {
  const userId = req.user.id;
  const {
    draft_version_id,
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
    works,
    media,
    relationships,
  } = req.body;

  try {
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user || !user.allowed_to_contribute) {
      return res.status(403).json({ success: false, message: "You are not allowed to contribute" });
    }

    const parsedLanguageId = language_id ? parseInt(language_id) : null;
    const parsedRegionId = region_id ? parseInt(region_id) : null;

    let existingDraft = null;
    if (draft_version_id) {
      existingDraft = await prisma.scholar_versions.findUnique({ where: { version_id: parseInt(draft_version_id) } });
      if (!existingDraft || existingDraft.status !== "draft" || existingDraft.created_by !== userId) {
        return res.status(404).json({ success: false, message: "Draft not found" });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let scholar;
      let version;

      if (existingDraft) {
        scholar = { scholar_id: existingDraft.scholar_id };
        version = await tx.scholar_versions.update({
          where: { version_id: existingDraft.version_id },
          data: {
            language_id: parsedLanguageId,
            canonical_name: canonical_name || null,
            region_id: parsedRegionId,
            century_hijri_start: century_hijri_start ? parseInt(century_hijri_start) : null,
            century_hijri_end: century_hijri_end ? parseInt(century_hijri_end) : null,
            century_gregorian_start: century_gregorian_start ? parseInt(century_gregorian_start) : null,
            century_gregorian_end: century_gregorian_end ? parseInt(century_gregorian_end) : null,
            biography: biography || null,
          },
        });

        await tx.scholar_aliases.deleteMany({ where: { version_id: version.version_id } });
        await tx.scholar_dates.deleteMany({ where: { version_id: version.version_id } });
        await tx.scholar_disciplines.deleteMany({ where: { version_id: version.version_id } });
        await tx.scholar_works.deleteMany({ where: { version_id: version.version_id } });
        await tx.media.deleteMany({ where: { version_id: version.version_id } });
        await tx.scholar_references.deleteMany({ where: { version_id: version.version_id } });
        await tx.scholar_relationships.deleteMany({ where: { version_id: version.version_id } });
      } else {
        scholar = scholar_id
          ? await tx.scholars.findUnique({ where: { scholar_id: parseInt(scholar_id) } })
          : await tx.scholars.create({ data: { created_by: userId, created_at: new Date() } });

        if (scholar_id && !scholar) throw new Error("SCHOLAR_NOT_FOUND");

        version = await tx.scholar_versions.create({
          data: {
            scholar_id: scholar.scholar_id,
            language_id: parsedLanguageId,
            canonical_name: canonical_name || null,
            region_id: parsedRegionId,
            century_hijri_start: century_hijri_start ? parseInt(century_hijri_start) : null,
            century_hijri_end: century_hijri_end ? parseInt(century_hijri_end) : null,
            century_gregorian_start: century_gregorian_start ? parseInt(century_gregorian_start) : null,
            century_gregorian_end: century_gregorian_end ? parseInt(century_gregorian_end) : null,
            biography: biography || null,
            version_type: scholar_id ? "edition" : "creation",
            status: "draft",
            created_by: userId,
            created_at: new Date(),
          },
        });

        await tx.scholar_contributors.upsert({
          where: { scholar_id_user_id: { scholar_id: scholar.scholar_id, user_id: userId } },
          create: { scholar_id: scholar.scholar_id, user_id: userId },
          update: {},
        });
      }

      if (aliases && aliases.length > 0) {
        await tx.scholar_aliases.createMany({ data: aliases.map((a) => ({ version_id: version.version_id, alias_name: a })) });
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
      if (discipline_ids && discipline_ids.length > 0) {
        await tx.scholar_disciplines.createMany({
          data: discipline_ids.map((did) => ({ version_id: version.version_id, discipline_id: did })),
          skipDuplicates: true,
        });
      }
      if (works && works.length > 0) {
        await tx.scholar_works.createMany({
          data: works.map((w) => ({
            version_id: version.version_id,
            title: w.title || "",
            year: w.year ? parseInt(w.year) : null,
            format: w.format || "OTHER",
            description: w.description || null,
            media_url: w.media_url || null,
            created_by: userId,
          })),
        });
      }
      if (media && media.length > 0) {
        await tx.media.createMany({
          data: media.map((m) => ({
            version_id: version.version_id,
            title: m.title || "",
            year: m.year ? parseInt(m.year) : null,
            description: m.description || null,
            media_url: m.media_url || null,
            uploaded_by: userId,
          })),
        });
      }
      if (references && references.length > 0) {
        await tx.scholar_references.createMany({
          data: references.map((r) => ({
            version_id: version.version_id,
            title: r.title || "",
            citation: r.citation || "",
            url: r.url || null,
            created_by: userId,
          })),
        });
      }

      // ✅ Relationships: Prevent self-relation and array duplicates
      if (relationships && relationships.length > 0) {
        const currentScholarId = existingDraft ? existingDraft.scholar_id : (scholar_id ? parseInt(scholar_id) : null);
        const relatedVersionIds = [...new Set(relationships.map(r => parseInt(r.related_version_id)))];
        
        const relatedVersions = await prisma.scholar_versions.findMany({
          where: { version_id: { in: relatedVersionIds } },
          select: { version_id: true, scholar_id: true, canonical_name: true },
        });

        const uniqueRels = [];
        const seen = new Set();

        for (const rel of relationships) {
          const related = relatedVersions.find(v => v.version_id === parseInt(rel.related_version_id));
          if (!related) throw new Error(`Related version ${rel.related_version_id} not found.`);
          
          if (currentScholarId && related.scholar_id === currentScholarId) {
            throw new Error("A scholar cannot have a relationship with themselves.");
          }

          const key = `${rel.related_version_id}-${rel.relation_type}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueRels.push(rel);
          }
        }

        for (const rel of uniqueRels) {
          await tx.scholar_relationships.create({
            data: {
              version_id: version.version_id,
              related_version_id: parseInt(rel.related_version_id),
              relation_type: rel.relation_type,
            },
          });
        }
      }

      return { scholar, version };
    });

    return res.json({
      success: true,
      message: "Draft saved",
      data: { draft_version_id: result.version.version_id, scholar_id: result.scholar.scholar_id },
    });
  } catch (error) {
    if (error.message === "SCHOLAR_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Scholar not found" });
    }
    console.error("saveDraft error:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

exports.getMyDrafts = async (req, res) => {
  const userId = req.user.id;
  try {
    const drafts = await prisma.scholar_versions.findMany({
      where: { created_by: userId, status: "draft" },
      include: { scholars: true, languages: true },
      orderBy: { created_at: "desc" },
    });
    res.json({ success: true, data: drafts });
  } catch (error) {
    console.error("getMyDrafts error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getDraftById = async (req, res) => {
  const userId = req.user.id;
  const versionId = parseInt(req.params.versionId);
  try {
    const draft = await prisma.scholar_versions.findUnique({
      where: { version_id: versionId },
      include: {
        scholar_aliases: true,
        scholar_dates: true,
        scholar_disciplines: { include: { disciplines: true } },
        scholar_works: true,
        media: true,
        scholar_references: true,
        scholar_relationships_as_source: { include: { related_scholar_version: true } },
      },
    });

    if (!draft || draft.status !== "draft" || draft.created_by !== userId) {
      return res.status(404).json({ success: false, message: "Draft not found" });
    }

    res.json({ success: true, data: draft });
  } catch (error) {
    console.error("getDraftById error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteDraft = async (req, res) => {
  const userId = req.user.id;
  const versionId = parseInt(req.params.versionId);
  try {
    const draft = await prisma.scholar_versions.findUnique({ where: { version_id: versionId } });

    if (!draft || draft.status !== "draft" || draft.created_by !== userId) {
      return res.status(404).json({ success: false, message: "Draft not found" });
    }

    await prisma.scholar_versions.delete({ where: { version_id: versionId } });
    res.json({ success: true, message: "Draft deleted" });
  } catch (error) {
    console.error("deleteDraft error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// SUBMIT DRAFT — turns a draft into a real pending submission.
// Same version_id (no new row created). Runs the SAME required-field
// checks as createScholar. If it fails, the draft stays a draft
// untouched. If it passes, status flips draft -> pending and admins
// get notified — exactly like a normal submission.
//
// NOTE: drafts never had files uploaded (see earlier design decision),
// so a draft has no portrait/work-file/media-file at submit time.
// If canonical_name/biography/etc were entered, they're already saved
// on the version row from saveDraft — we don't need to re-send them.
// ============================================================

exports.submitDraft = async (req, res) => {
  const userId = req.user.id;
  const versionId = parseInt(req.params.versionId);

  try {
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user || !user.allowed_to_contribute) {
      return res.status(403).json({ success: false, message: "You are not allowed to contribute" });
    }

    const draft = await prisma.scholar_versions.findUnique({
      where: { version_id: versionId },
      include: {
        scholar_works: true,
        media: true,
        scholar_references: true,
        scholar_relationships_as_source: true,
        scholars: true,
      },
    });

    if (!draft || draft.status !== "draft" || draft.created_by !== userId) {
      return res.status(404).json({ success: false, message: "Draft not found" });
    }

    // ── Same required-field checks as createScholar ──
    if (!draft.canonical_name) {
      return res.status(400).json({ success: false, message: "canonical_name is required" });
    }
    if (!draft.biography) {
      return res.status(400).json({ success: false, message: "biography is required" });
    }
    if (!draft.language_id) {
      return res.status(400).json({ success: false, message: "language_id is required" });
    }

    // ── Same works validation ──
    for (let i = 0; i < draft.scholar_works.length; i++) {
      const w = draft.scholar_works[i];
      if (!w.title) {
        return res.status(400).json({ success: false, message: `Work #${i + 1}: title is required.` });
      }
      if (!WORK_FORMATS.has(w.format)) {
        return res.status(400).json({ success: false, message: `Work #${i + 1}: invalid format.` });
      }
    }

    // ── Same media validation ──
    for (let i = 0; i < draft.media.length; i++) {
      const m = draft.media[i];
      if (!m.media_url) {
        return res.status(400).json({
          success: false,
          message: `Media #${i + 1}: requires a media_url (drafts don't support file uploads — please attach a link, or upload the file on final submit instead).`,
        });
      }
    }

    // ── Same references validation ──
    for (let i = 0; i < draft.scholar_references.length; i++) {
      const r = draft.scholar_references[i];
      if (!r.title) {
        return res.status(400).json({ success: false, message: `Reference #${i + 1}: title is required.` });
      }
      if (!r.citation) {
        return res.status(400).json({ success: false, message: `Reference #${i + 1}: citation is required.` });
      }
    }

    // ── Same relationships validation ──
    for (let i = 0; i < draft.scholar_relationships_as_source.length; i++) {
      const rel = draft.scholar_relationships_as_source[i];
      if (!rel.related_version_id) {
        return res.status(400).json({ success: false, message: `Relationship #${i + 1}: related_version_id is required.` });
      }
      if (!["teacher", "student"].includes(rel.relation_type)) {
        return res.status(400).json({ success: false, message: `Relationship #${i + 1}: relation_type must be 'teacher' or 'student'.` });
      }
    }

    // ── All valid — flip status ──
    const updated = await prisma.scholar_versions.update({
      where: { version_id: versionId },
      data: { status: "pending" },
    });

    const admins = await prisma.users.findMany({
      where: { roles: { role_name: "admin" } },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notifications.createMany({
        data: admins.map((admin) => ({
          user_id: admin.id,
          type: "NEW_SCHOLAR_SUBMISSION",
          message: `New scholar submitted (from draft): "${draft.canonical_name}"`,
          related_entity: `scholar:${draft.scholar_id}`,
          is_read: false,
          created_at: new Date(),
        })),
      });
    }

    return res.json({ success: true, message: "Draft submitted for review", data: updated });
  } catch (error) {
    console.error("submitDraft error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
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
            scholar_disciplines: {
              include: {
                disciplines: true,
              },
            },
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
            // ✅ MOVED HERE: Relationships now belong to the VERSION, not the scholar
            scholar_relationships_as_source: {
              include: {
                related_scholar_version: {
                  include: {
                    scholars: { select: { scholar_id: true, created_at: true } },
                    languages: { select: { code: true, name: true } },
                  }
                }
              }
            }
          } // <-- This closes scholar_versions include
        }, // <-- This closes scholar_versions

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
        }
        // ❌ REMOVED scholar_relationships_as_source from this level
        
      }, // <-- This closes the main include
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

  // ✅ 1. Handle both flat req.body and multipart req.body.data
  let payload = req.body;
  if (req.body.data) {
    try {
      payload = JSON.parse(req.body.data);
    } catch (err) {
      return res.status(400).json({ success: false, message: "Invalid JSON in 'data' field" });
    }
  }

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
    dates,
    new_references,
    new_relationships,
  } = payload;
  
  // ✅ 2. Build file lookup for multipart uploads
  const filesByField = {};
  (req.files || []).forEach((f) => { filesByField[f.fieldname] = f; });
  
  if (!canonical_name) {
    return res.status(400).json({ success: false, message: "canonical_name is required" });
  }

  if (dates && dates.length > 0) {
    for (let i = 0; i < dates.length; i++) {
      const d = dates[i];
      if (!["birth", "death"].includes(d.date_type)) {
        return res.status(400).json({ success: false, message: `Date #${i + 1}: date_type must be 'birth' or 'death'` });
      }
      if (!["hijri", "gregorian"].includes(d.calendar)) {
        return res.status(400).json({ success: false, message: `Date #${i + 1}: calendar must be 'hijri' or 'gregorian'` });
      }
    }
  }

  try {
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user || !user.allowed_to_contribute) {
      return res.status(403).json({ success: false, message: "You are not allowed to contribute" });
    }

    const scholar = await prisma.scholars.findUnique({ where: { scholar_id: scholarId } });
    if (!scholar) {
      return res.status(404).json({ success: false, message: "Scholar not found" });
    }

    const parsedLanguageId = parseInt(language_id);

    const previousVersion = await prisma.scholar_versions.findFirst({
      where: { scholar_id: scholarId, language_id: parsedLanguageId, status: "approved" },
      include: {
        scholar_aliases: true,
        scholar_disciplines: true,
        scholar_works: true,
        media: true,
        scholar_references: true,
        scholar_dates: true,
        scholar_relationships_as_source: true,
      },
      orderBy: { created_at: "desc" },
    });

    if (!previousVersion) {
      return res.status(404).json({ success: false, message: "No approved version exists for this scholar in this language" });
    }

    const finalCanonicalName = canonical_name ?? previousVersion.canonical_name;
    const finalRegionId = region_id !== undefined ? (region_id === null ? null : parseInt(region_id)) : previousVersion.region_id;
    const finalHijriStart = century_hijri_start !== undefined ? (century_hijri_start === null ? null : parseInt(century_hijri_start)) : previousVersion.century_hijri_start;
    const finalHijriEnd = century_hijri_end !== undefined ? (century_hijri_end === null ? null : parseInt(century_hijri_end)) : previousVersion.century_hijri_end;
    const finalGregorianStart = century_gregorian_start !== undefined ? (century_gregorian_start === null ? null : parseInt(century_gregorian_start)) : previousVersion.century_gregorian_start;
    const finalGregorianEnd = century_gregorian_end !== undefined ? (century_gregorian_end === null ? null : parseInt(century_gregorian_end)) : previousVersion.century_gregorian_end;
    const finalBiography = biography !== undefined ? biography : previousVersion.biography;
    const finalAliases = aliases !== undefined ? aliases : previousVersion.scholar_aliases.map((a) => a.alias_name);
    const finalDisciplineIds = discipline_ids !== undefined ? discipline_ids : previousVersion.scholar_disciplines.map((d) => d.discipline_id);
    const finalImageUrl = previousVersion.image_url;
    const finalImageStatus = previousVersion.image_status;
    const finalImageUploadedBy = previousVersion.image_uploaded_by;

    if (finalDisciplineIds.length > 0) {
      const found = await prisma.disciplines.findMany({ where: { discipline_id: { in: finalDisciplineIds } } });
      if (found.length !== finalDisciplineIds.length) {
        return res.status(400).json({ success: false, message: "One or more disciplines are invalid." });
      }
    }

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
          image_url: finalImageUrl,
          image_status: finalImageStatus,
          image_uploaded_by: finalImageUploadedBy,
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

      if (finalDisciplineIds.length > 0) {
        await tx.scholar_disciplines.createMany({
          data: finalDisciplineIds.map((did) => ({
            version_id: version.version_id,
            discipline_id: did,
          })),
          skipDuplicates: true,
        });
      }

      const datesToCreate = (dates && dates.length > 0) ? dates : previousVersion.scholar_dates;
      if (datesToCreate && datesToCreate.length > 0) {
        await tx.scholar_dates.createMany({
          data: datesToCreate.map((d) => ({
            version_id: version.version_id,
            date_type: d.date_type,
            calendar: d.calendar,
            year: d.year ? parseInt(d.year) : null,
            is_approximate: !!d.is_approximate,
            raw_text: d.raw_text || null,
          })),
        });
      }

      if (new_references && new_references.length > 0) {
        await tx.scholar_references.createMany({
          data: new_references.map((r) => ({
            version_id: version.version_id,
            title: r.title,
            citation: r.citation,
            url: r.url || null,
            created_by: userId,
            status: "pending",
          })),
        });
      }

      if (new_relationships && new_relationships.length > 0) {
        const relatedVersionIds = [...new Set(new_relationships.map(r => parseInt(r.related_version_id)))];
        const relatedVersions = await prisma.scholar_versions.findMany({
          where: { version_id: { in: relatedVersionIds } },
          select: { version_id: true, scholar_id: true, canonical_name: true },
        });

        const existingDirect = new Set();
        const existingInverse = new Set();

        for (const rel of previousVersion.scholar_relationships_as_source) {
          existingDirect.add(`${rel.related_version_id}-${rel.relation_type}`);
          const invType = rel.relation_type === 'teacher' ? 'student' : 'teacher';
          existingInverse.add(`${rel.related_version_id}-${invType}`);
        }

        const seenInRequest = new Set();
        const validatedNewRels = [];

        for (const rel of new_relationships) {
          const targetVId = parseInt(rel.related_version_id);
          const type = rel.relation_type;
          const key = `${targetVId}-${type}`;

          const targetScholar = relatedVersions.find(v => v.version_id === targetVId);
          if (!targetScholar) throw new Error(`Related version ${targetVId} not found.`);
          
          if (targetScholar.scholar_id === scholarId) {
            throw new Error("A scholar cannot have a relationship with themselves.");
          }

          if (seenInRequest.has(key)) continue;
          seenInRequest.add(key);

          if (existingDirect.has(key)) {
            throw new Error(`Relationship already exists: ${targetScholar.canonical_name} is already your ${type}.`);
          }

          if (existingInverse.has(key)) {
            const invType = type === 'teacher' ? 'student' : 'teacher';
            throw new Error(`Bidirectional conflict: ${targetScholar.canonical_name} is already recorded as your ${invType}.`);
          }

          validatedNewRels.push(rel);
        }

        for (const rel of validatedNewRels) {
          await tx.scholar_relationships.create({
            data: {
              version_id: version.version_id,
              related_version_id: parseInt(rel.related_version_id),
              relation_type: rel.relation_type,
            },
          });
        }
      }

      await tx.scholar_contributors.upsert({
        where: { scholar_id_user_id: { scholar_id: scholarId, user_id: userId } },
        create: { scholar_id: scholarId, user_id: userId },
        update: {},
      });

      return version;
    });

    // ✅ 3. POST-TRANSACTION: Handle Image Upload for Edit
    // TREAT IMAGE EXACTLY LIKE MEDIA/WORKS: Only upload to img_versions.
    // DO NOT update scholar_versions yet. This protects the old image until approval.
    const sideEffectErrors = [];
    let imageResult = null;
    const imageFile = filesByField["image"];
    
    if (imageFile) {
      console.log("🖼️ ATTEMPTING TO UPLOAD IMAGE:", imageFile.originalname);
      
      try {
        imageResult = await uploadScholarImageService({ 
          version_id: newVersion.version_id, 
          file: imageFile, 
          uploaded_by: userId 
        });
        // ✅ REMOVED: prisma.scholar_versions.update block. 
        // The image now lives safely in img_versions until the admin approves it.
      } catch (err) {
        sideEffectErrors.push({ type: "image", message: err.message });
      }
    }

    const admins = await prisma.users.findMany({ where: { roles: { role_name: "admin" } }, select: { id: true } });
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

    // ✅ 4. Return response with image result and any warnings
    res.json({
      success: true,
      message: "Edit submitted for review",
      data: {
        newVersion: newVersion,
        image: imageResult || null, // ✅ Now returns the uploaded image data
        carriedOverContent: {
          works: previousVersion.scholar_works,
          media: previousVersion.media,
          references: previousVersion.scholar_references,
          dates: previousVersion.scholar_dates,
          relationships: previousVersion.scholar_relationships_as_source,
        }
      },
      warnings: sideEffectErrors.length > 0 ? sideEffectErrors : undefined, // ✅ Exposes hidden errors
    });

  } catch (error) {
    console.error("editScholar error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
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

exports.addScholarRelationship = async (req, res) => {
  const { version_id, related_version_id, relation_type } = req.body;

  if (!["teacher", "student"].includes(relation_type)) {
    return res.status(400).json({ success: false, message: "relation_type must be 'teacher' or 'student'" });
  }

  if (!version_id || !related_version_id) {
    return res.status(400).json({ success: false, message: "version_id and related_version_id are required" });
  }

  const v1_id = parseInt(version_id);
  const v2_id = parseInt(related_version_id);

  if (v1_id === v2_id) {
    return res.status(400).json({ success: false, message: "A version cannot be related to itself" });
  }

  try {
    const [v1, v2] = await Promise.all([
      prisma.scholar_versions.findUnique({ where: { version_id: v1_id }, select: { scholar_id: true, canonical_name: true } }),
      prisma.scholar_versions.findUnique({ where: { version_id: v2_id }, select: { scholar_id: true, canonical_name: true } }),
    ]);

    if (!v1 || !v2) {
      return res.status(404).json({ success: false, message: "One or both scholar versions not found" });
    }

    // 1. Prevent linking two different versions of the SAME scholar
    if (v1.scholar_id === v2.scholar_id) {
      return res.status(400).json({ success: false, message: "A scholar cannot have a relationship with themselves." });
    }

    // 2. Prevent direct duplicates
    const existing = await prisma.scholar_relationships.findFirst({
      where: {
        version_id: v1_id,
        related_version_id: v2_id,
        relation_type: relation_type,
      },
    });

    if (existing) {
      return res.status(400).json({ success: false, message: `This relationship already exists: ${v2.canonical_name} is already your ${relation_type}.` });
    }

    // 3. Prevent bidirectional duplicates
    const inverseType = relation_type === "teacher" ? "student" : "teacher";
    const existingInverse = await prisma.scholar_relationships.findFirst({
      where: {
        version_id: v2_id,
        related_version_id: v1_id,
        relation_type: inverseType,
      },
    });

    if (existingInverse) {
      return res.status(400).json({ 
        success: false, 
        message: `Bidirectional conflict: ${v2.canonical_name} is already recorded as your ${inverseType}.` 
      });
    }

    const relationship = await prisma.scholar_relationships.create({
      data: {
        version_id: v1_id,
        related_version_id: v2_id,
        relation_type: relation_type,
      },
    });

    return res.json({ success: true, message: "Relationship created successfully", data: relationship });
  } catch (error) {
    console.error("addScholarRelationship error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};