const prisma = require("../config/db");


// helper 
// near the top of disciplines.controller.js, or in a shared utils file if you want to reuse it elsewhere
async function validateTranslations(translations) {
  const languages = await prisma.languages.findMany({
    select: { code: true },
  });
  const validCodes = new Set(languages.map((l) => l.code));

  const keys = Object.keys(translations);

  for (const key of keys) {
    if (!validCodes.has(key)) {
      return `"${key}" is not a valid language code. Valid codes: ${[...validCodes].join(", ")}`;
    }
    const value = translations[key];
    if (typeof value !== "string" || value.trim() === "") {
      return `Translation for "${key}" must be a non-empty string`;
    }
  }

  return null; // no error
}

// ===================================================
// Create discipline (Dynamic JSON translations)
// ===================================================
exports.createDiscipline = async (req, res) => {
  const { translations, image_url } = req.body;
  const userId = req.user.id;

  if (!translations || typeof translations !== "object" || Object.keys(translations).length === 0) {
    return res.status(400).json({
      success: false,
      message: "Valid translations object is required",
    });
  }


  const translationsError = await validateTranslations(translations);   // ADD
  if (translationsError) {                                              // ADD
    return res.status(400).json({ success: false, message: translationsError });  // ADD
  }
  
  try {
    const discipline = await prisma.$transaction(async (tx) => {
      // ✅ THIS IS THE FIX: It takes the first language you filled in and uses it as 'name'.
      const fallbackName = translations.en || Object.values(translations)[0] || "Unnamed Discipline";

      const newDiscipline = await tx.disciplines.create({
        data: {
          name: fallbackName,          // ✅ This satisfies Prisma's requirement
          translations: translations,
          image_url: image_url ? image_url.trim() : null,
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
            type: "NEW_DISCIPLINE_SUBMISSION",
            message: `New discipline added: "${fallbackName}"`,
            related_entity: `discipline:${newDiscipline.discipline_id}`,
            is_read: false,
            created_at: new Date(),
          })),
        });
      }

      return newDiscipline;
    });

    return res.status(201).json({
      success: true,
      message: "Discipline created successfully",
      data: discipline,
    });
  } catch (error) {
    console.error("createDiscipline error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===================================================
// Get all disciplines (Dynamic: Frontend picks the right translation)
// ===================================================
exports.getAllDisciplines = async (req, res) => {
  try {
    const disciplines = await prisma.disciplines.findMany({
      orderBy: { discipline_id: "asc" },
    });

    const formattedDisciplines = disciplines.map((d) => ({
      ...d,
      translations: typeof d.translations === "string" ? JSON.parse(d.translations) : d.translations,
    }));

    res.json({
      success: true,
      data: formattedDisciplines,
    });
  } catch (error) {
    console.error("getAllDisciplines error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===================================================
// Update discipline (replaces the entire translations JSON)
// ===================================================
exports.updateDiscipline = async (req, res) => {
  const id = Number(req.params.id);
  const { translations, image_url } = req.body;

  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, message: "Invalid discipline id" });
  }

  if (!translations || typeof translations !== "object" || Object.keys(translations).length === 0) {
    return res.status(400).json({ success: false, message: "Valid translations object is required" });
  }


  const translationsError = await validateTranslations(translations);   // ADD
  if (translationsError) {                                              // ADD
    return res.status(400).json({ success: false, message: translationsError });  // ADD
  }

  try {

    // u can remove it and repalcle it with p2025
    const discipline = await prisma.disciplines.findUnique({ where: { discipline_id: id } });
 
    if (!discipline) {
      return res.status(404).json({ success: false, message: "Discipline not found" });
    }

    const updated = await prisma.disciplines.update({
      where: { discipline_id: id },
      data: { 
        translations: translations,
        ...(image_url !== undefined ? { image_url: image_url.trim() || null } : {})
      },
    });

    res.json({
      success: true,
      message: "Discipline updated",
      data: updated,
    });
  } catch (error) {
    console.error("updateDiscipline error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===================================================
// Delete discipline
// ===================================================
exports.deleteDiscipline = async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, message: "Invalid discipline id" });
  }

  try {
    const discipline = await prisma.disciplines.findUnique({ where: { discipline_id: id } });

    if (!discipline) {
      return res.status(404).json({ success: false, message: "Discipline not found" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.scholar_disciplines.deleteMany({
        where: { discipline_id: id },
      });

      await tx.disciplines.delete({
        where: { discipline_id: id },
      });
    });

    res.json({
      success: true,
      message: "Discipline deleted successfully",
    });
  } catch (error) {
    console.error("deleteDiscipline error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===================================================
// Upload Discipline Image
// ===================================================
exports.uploadDisciplineImage = async (req, res) => {
  try {
    const disciplineId = parseInt(req.params.id);

    if(Number.isNaN(disciplineId)) {
      return  res.status(400).json({ success: false, message: "Invalid discipline id" });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    const imageUrl = req.file.path; 

    const updated = await prisma.disciplines.update({
      where: { discipline_id: disciplineId },
      data: { image_url: imageUrl }
    });

    res.json({
      success: true,
      message: "Discipline image uploaded successfully",
      data: updated
    });
  } catch (error) {

    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Discipline not found" });
    }

    console.error("uploadDisciplineImage error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};