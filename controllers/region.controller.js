const prisma = require("../config/db");

// ===================================================
// Create region (Dynamic JSON translations)
// ===================================================
exports.createRegion = async (req, res) => {
  const { translations } = req.body; 
  const userId = req.user.id;

  if (!translations || typeof translations !== "object" || Object.keys(translations).length === 0) {
    return res.status(400).json({
      success: false,
      message: "Valid translations object is required",
    });
  }

  try {
    const region = await prisma.$transaction(async (tx) => {
      // ✅ THIS IS THE FIX: It takes the first language you filled in 
      // (even if it's just Arabic or French) and uses it as the required 'name'.
      const fallbackName = translations.en || Object.values(translations)[0] || "Unnamed Region";

      const newRegion = await tx.regions.create({
        data: {
          name: fallbackName,          // ✅ This satisfies Prisma's requirement
          translations: translations, 
          created_at: new Date(),
        },
      });

      const admins = await tx.users.findMany({
        where: { roles: { role_name: "admin" }, id: { not: userId } },
        select: { id: true },
      });

      if (admins.length > 0) {
        await tx.notifications.createMany({
          data: admins.map((admin) => ({
            user_id: admin.id,
            type: "NEW_REGION_SUBMISSION",
            message: `New region added: "${fallbackName}"`,
            related_entity: `region:${newRegion.region_id}`,
            is_read: false,
            created_at: new Date(),
          })),
        });
      }

      return newRegion;
    });

    return res.status(201).json({
      success: true,
      message: "Region created successfully",
      data: region,
    });
  } catch (error) {
    console.error("createRegion error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===================================================
// Get all regions (Dynamic: Frontend picks the right translation)
// ===================================================
exports.getAllRegions = async (req, res) => {
  try {
    const regions = await prisma.regions.findMany({
      orderBy: { region_id: "asc" },
    });

    // Ensure translations are parsed as objects (safe fallback)
    const formattedRegions = regions.map((r) => ({
      ...r,
      translations: typeof r.translations === "string" ? JSON.parse(r.translations) : r.translations,
    }));

    res.json({
      success: true,
      data: formattedRegions,
    });
  } catch (error) {
    console.error("getAllRegions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===================================================
// Update region (replaces the entire translations JSON)
// ===================================================
exports.updateRegion = async (req, res) => {
  const id = Number(req.params.id);
  const { translations } = req.body;

  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, message: "Invalid region id" });
  }

  if (!translations || typeof translations !== "object" || Object.keys(translations).length === 0) {
    return res.status(400).json({ success: false, message: "Valid translations object is required" });
  }

  try {
    const region = await prisma.regions.findUnique({ where: { region_id: id } });

    if (!region) {
      return res.status(404).json({ success: false, message: "Region not found" });
    }

    const updated = await prisma.regions.update({
      where: { region_id: id },
      data: { translations: translations },
    });

    res.json({
      success: true,
      message: "Region updated",
      data: updated,
    });
  } catch (error) {
    console.error("updateRegion error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===================================================
// Delete region
// ===================================================
exports.deleteRegion = async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, message: "Invalid region id" });
  }

  try {
    const region = await prisma.regions.findUnique({ where: { region_id: id } });

    if (!region) {
      return res.status(404).json({ success: false, message: "Region not found" });
    }

    // Prevent deletion if scholars are still using this region ID
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
      where: { region_id: id },
    });

    res.json({
      success: true,
      message: "Region deleted successfully",
    });
  } catch (error) {
    console.error("deleteRegion error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};