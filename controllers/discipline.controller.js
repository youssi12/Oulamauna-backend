const prisma = require("../config/db");

const DEFAULT_LANGUAGE_ID = 1; // 'ar' — Arabic

// ===================================================
// Create discipline (language-dependent)
// ===================================================

 exports.createDiscipline = async (req, res) => {
  const name = req.body.name?.trim();
  const language_id = req.body.language_id
    ? parseInt(req.body.language_id, 10)
    : DEFAULT_LANGUAGE_ID;

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

    const existing = await prisma.disciplines.findFirst({
      where: {
        name,
        language_id,
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Discipline already exists",
      });
    }

    const discipline = await prisma.$transaction(async (tx) => {
      const discipline = await tx.disciplines.create({
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
            type: "NEW_DISCIPLINE_SUBMISSION",
            message: `New discipline added: "${discipline.name}"`,
            related_entity: `discipline:${discipline.discipline_id}`,
            is_read: false,
            created_at: new Date(),
          })),
        });
      }

      return discipline;
    });

    return res.status(201).json({
      success: true,
      message: "Discipline created successfully",
      data: discipline,
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
// Get all disciplines (filtered by language_id)
// ===================================================

exports.getAllDisciplines = async (req, res) => {
  const language_id = req.query.language_id
  ? parseInt(req.query.language_id, 10)
  : DEFAULT_LANGUAGE_ID;

if (Number.isNaN(language_id)) {
  return res.status(400).json({
    success: false,
    message: "language_id must be a valid number",
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

    const disciplines = await prisma.disciplines.findMany({
      where: {
        language_id,
      },
      orderBy: {
        discipline_id: "asc",
      },
    });

    res.json({
      success: true,
      data: disciplines,
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
// Update discipline (scoped to language_id)
// ===================================================

exports.updateDiscipline = async (req, res) => {
   const id = Number(req.params.id);

if (!Number.isInteger(id)) {
  return res.status(400).json({
    success: false,
    message: "Invalid discipline id",
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
    const discipline = await prisma.disciplines.findUnique({
      where: {
        discipline_id: id,
      },
    });

    if (!discipline) {
      return res.status(404).json({
        success: false,
        message: "Discipline not found",
      });
    }
     const existing = await prisma.disciplines.findFirst({
  where: {
    name,
    language_id: discipline.language_id,
    NOT: {
      discipline_id: id,
    },
  },
});

if (existing) {
  return res.status(409).json({
    success: false,
    message: "Discipline already exists",
  });
}

    const updated = await prisma.disciplines.update({
      where: {
        discipline_id: id,
      },
      data: {
        name,
      },
    });

    res.json({
      success: true,
      message: "Discipline updated",
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
// Delete discipline (scoped to language_id)
// ===================================================

 exports.deleteDiscipline = async (req, res) => {
   const id = Number(req.params.id);

if (!Number.isInteger(id)) {
  return res.status(400).json({
    success: false,
    message: "Invalid discipline id",
  });
}

  try {
    const discipline = await prisma.disciplines.findUnique({
      where: {
        discipline_id: id,
      },
    });

    if (!discipline) {
      return res.status(404).json({
        success: false,
        message: "Discipline not found",
      });
    }

    // scholar_disciplines has no onDelete: Cascade in your schema, so rows
    // linking scholars to this discipline must be removed first or the
    // delete will fail on the foreign key constraint.
    await prisma.$transaction(async (tx) => {
      await tx.scholar_disciplines.deleteMany({
        where: {
          discipline_id: id,
        },
      });

      await tx.disciplines.delete({
        where: {
          discipline_id: id,
        },
      });
    });

    res.json({
      success: true,
      message: "Discipline deleted successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};