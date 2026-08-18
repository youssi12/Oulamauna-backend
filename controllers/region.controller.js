const prisma = require("../config/db");

const DEFAULT_LANGUAGE_ID = 1; // 'ar' — Arabic

// ===================================================
// Create region (language-dependent, any logged-in contributor,
// admins notified)
// ===================================================

exports.createRegion = async (req, res) => {
  const name = req.body.name?.trim();
  const language_id = req.body.language_id
    ? parseInt(req.body.language_id, 10)
    : DEFAULT_LANGUAGE_ID;
  const userId = req.user.id;

  if (Number.isNaN(language_id)) {
    return res.status(400).json({
      success: false,
      message: "language_id must be a valid number",
    });
  }

  if (!name) {
    return res.status(400).json({
      success: false,
      message: "name is required",
    });
  }

  try {
    const language = await prisma.languages.findUnique({
      where: { language_id },
    });

    if (!language) {
      return res.status(400).json({
        success: false,
        message: `Unknown language_id "${language_id}"`,
      });
    }

    const existing = await prisma.regions.findFirst({
      where: {
        name,
        language_id,
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Region already exists",
      });
    }

    const region = await prisma.$transaction(async (tx) => {
      const region = await tx.regions.create({
        data: {
          name,
          language_id,
          created_at: new Date(),
        },
      });

      const admins = await tx.users.findMany({
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
        await tx.notifications.createMany({
          data: admins.map((admin) => ({
            user_id: admin.id,
            type: "NEW_REGION_SUBMISSION",
            message: `New region added: "${region.name}"`,
            related_entity: `region:${region.region_id}`,
            is_read: false,
            created_at: new Date(),
          })),
        });
      }

      return region;
    });

    return res.status(201).json({
      success: true,
      message: "Region created successfully",
      data: region,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ===================================================
// Get all regions (filtered by language_id)
// ===================================================

exports.getAllRegions = async (req, res) => {
  const langCode = req.query.lang; // e.g. "en", "ar", "fr" from frontend
  let language_id = DEFAULT_LANGUAGE_ID;

  try {
    // 1. If frontend sends ?lang=ar, find the correct language_id for "ar"
    if (langCode) {
      const language = await prisma.languages.findFirst({
        where: { code: langCode },
      });
      if (language) language_id = language.language_id;
    } 
    // 2. Fallback: if someone sends ?language_id=3 directly
    else if (req.query.language_id) {
      const parsed = parseInt(req.query.language_id, 10);
      if (!Number.isNaN(parsed)) language_id = parsed;
    }

    const regions = await prisma.regions.findMany({
      where: {
        language_id,
      },
      orderBy: {
        region_id: "asc",
      },
    });

    res.json({
      success: true,
      data: regions,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ===================================================
// Update region (scoped to language_id)
// ===================================================
// language_id is intentionally NOT editable here — same reasoning as
// scholar_dates' date_type/calendar: it's part of how uniqueness is
// checked below. To move a region to a different language, delete and
// recreate it instead.

exports.updateRegion = async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid region id",
    });
  }

  const name = req.body.name?.trim();

  if (!name) {
    return res.status(400).json({
      success: false,
      message: "name is required",
    });
  }

  try {
    const region = await prisma.regions.findUnique({
      where: {
        region_id: id,
      },
    });

    if (!region) {
      return res.status(404).json({
        success: false,
        message: "Region not found",
      });
    }

    const existing = await prisma.regions.findFirst({
      where: {
        name,
        language_id: region.language_id,
        NOT: {
          region_id: id,
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Region already exists",
      });
    }

    const updated = await prisma.regions.update({
      where: {
        region_id: id,
      },
      data: {
        name,
      },
    });

    res.json({
      success: true,
      message: "Region updated",
      data: updated,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ===================================================
// Delete region (scoped to language_id)
// ===================================================
// region_id on scholar_versions has onDelete: NoAction — deleting a region
// that's still in use would throw an FK error. Rather than silently nulling
// out region_id on every scholar that used it, we block the delete and tell
// the admin to reassign those scholars first. Swap this for silent nulling
// if you'd rather allow it.

exports.deleteRegion = async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid region id",
    });
  }

  try {
    const region = await prisma.regions.findUnique({
      where: {
        region_id: id,
      },
    });

    if (!region) {
      return res.status(404).json({
        success: false,
        message: "Region not found",
      });
    }

    const inUseCount = await prisma.scholar_versions.count({
      where: { region_id: id },
    });

    if (inUseCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${inUseCount} scholar version(s) still reference this region. Reassign them first.`,
      });
    }

    await prisma.regions.delete({
      where: {
        region_id: id,
      },
    });

    res.json({
      success: true,
      message: "Region deleted successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};