const prisma = require("../config/db");
const { createReferenceService } = require("../service/references.service");

// ===================================================
// Create a reference for a scholar version (standalone)
// ===================================================

exports.createReference = async (req, res) => {
  const { version_id, title, citation, url } = req.body;
  const userId = req.user.id;

  if (!version_id) {
    return res.status(400).json({
      success: false,
      message: "version_id is required",
    });
  }

  try {
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user || !user.allowed_to_contribute) {
      return res.status(403).json({ success: false, message: "You are not allowed to contribute" });
    }

    const reference = await createReferenceService({ version_id, title, citation, created_by: userId,url });

    return res.status(201).json({
      success: true,
      message: "Reference added",
      data: reference,
    });
  } 
   catch (error) {
  console.error("createReference error:", error);

  if (error.message === "Scholar version not found") {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }

  return res.status(400).json({
    success: false,
    message: error.message || "Reference creation failed",
  });
}
};

// ===================================================
// Get all references for a scholar version
// ===================================================

exports.getScholarReferences = async (req, res) => {
  const versionId = parseInt(req.params.version_id);

  try {
     const references = await prisma.scholar_references.findMany({
  where: {
    version_id: versionId,
    status: "approved",
  },
  orderBy: {
    reference_id: "asc",
  },
});

    res.json({
      success: true,
      data: references,
    });
  } catch (error) {
    console.error("getScholarReferences error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

 // ===================================================
// Update a reference (metadata only)
// ===================================================
// FIX: ownership now checked via reference.created_by directly (the
// actual submitter of THIS reference), not reference.scholar_versions
// .created_by (the submitter of the whole scholar version). Those are
// often different people once references can be added independently.
//
// DESIGN DECISION: editing resets status to "pending" — an approved
// reference silently staying "approved" after its content changes would
// let moderation be bypassed by editing after approval. Remove this if
// you'd rather edits not require re-review.

 exports.updateReference = async (req, res) => {
  const referenceId = parseInt(req.params.id);
  const userId = req.user.id;
  const { title, citation, url } = req.body;

  try {
    const reference = await prisma.scholar_references.findUnique({
      where: {
        reference_id: referenceId,
      },
    });

    if (!reference) {
      return res.status(404).json({
        success: false,
        message: "Reference not found",
      });
    }

    const user = await prisma.users.findUnique({
      where: {
        id: userId,
      },
      include: {
        roles: true,
      },
    });

    const isOwner = reference.created_by === userId;
    const isAdmin = user?.roles?.role_name === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to edit this reference",
      });
    }

    // Only an approved reference can be edited
    if (reference.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Only approved references can be edited",
      });
    }

    // Create a NEW pending reference.
    // The original reference remains untouched.
    const newReference = await prisma.scholar_references.create({
      data: {
        version_id: reference.version_id,
        created_by: userId,

        title:
          title !== undefined
            ? title
            : reference.title,

        citation:
          citation !== undefined
            ? citation
            : reference.citation,

        url:
          url !== undefined
            ? url
            : reference.url,

        status: "pending",

        previous_reference_id: reference.reference_id,
      },
    });

    return res.json({
      success: true,
      message: "Reference edited and submitted for review",
      data: newReference,
    });

  } catch (error) {
    console.error("updateReference error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ===================================================
// Delete a reference
// ===================================================

exports.deleteReference = async (req, res) => {
  const referenceId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const reference = await prisma.scholar_references.findUnique({
      where: { reference_id: referenceId },
      include: { scholar_versions: true },
    });

    if (!reference) {
      return res.status(404).json({ success: false, message: "Reference not found" });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    const isOwner = reference.created_by === userId;
    const isAdmin = user?.roles?.role_name === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this reference" });
    }

    await prisma.scholar_references.delete({
      where: { reference_id: referenceId },
    });

    res.json({
      success: true,
      message: "Reference deleted successfully",
    });
  } catch (error) {
    console.error("deleteReference error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===================================================
//  approve a reference
// ===================================================

exports.approveReference = async (req, res) => {
  const referenceId = parseInt(req.params.id);

  try {
    const reference = await prisma.scholar_references.findUnique({
      where: {
        reference_id: referenceId,
      },
    });

    if (!reference) {
      return res.status(404).json({
        success: false,
        message: "Reference not found",
      });
    }

    if (reference.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Reference is not pending",
      });
    }

    // -----------------------------------------
    // Approve reference inside a transaction
    // -----------------------------------------

    const updated = await prisma.$transaction(async (tx) => {

      // -----------------------------------------
      // If this is an edited reference,
      // supersede the previous approved reference.
      // -----------------------------------------

      if (reference.previous_reference_id) {
        await tx.scholar_references.update({
          where: {
            reference_id: reference.previous_reference_id,
          },
          data: {
            status: "superseded",
          },
        });
      }

      // -----------------------------------------
      // Approve the new reference
      // -----------------------------------------

      return tx.scholar_references.update({
        where: {
          reference_id: referenceId,
        },
        data: {
          status: "approved",
        },
      });
    });

    // -----------------------------------------
    // Notify contributor
    // -----------------------------------------

    if (reference.created_by) {
      await prisma.notifications.create({
        data: {
          user_id: reference.created_by,
          type: "REFERENCE_APPROVED",
          message: `Your reference "${reference.title || "reference"}" has been approved.`,
          related_entity: `reference:${referenceId}`,
          is_read: false,
          created_at: new Date(),
        },
      });
    }

    return res.json({
      success: true,
      message: "Reference approved",
      data: updated,
    });

  } catch (error) {
    console.error("approveReference error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
// ===================================================
//   reject a reference
// ===================================================

 exports.rejectReference = async (req, res) => {
  const referenceId = parseInt(req.params.id);
  const { reason } = req.body || {};

  try {
    const reference = await prisma.scholar_references.findUnique({
      where: {
        reference_id: referenceId,
      },
    });

    if (!reference) {
      return res.status(404).json({
        success: false,
        message: "Reference not found",
      });
    }

    if (reference.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Reference is not pending",
      });
    }

    // Reject ONLY the pending edited copy.
    // The original approved reference stays untouched.
    const updated = await prisma.scholar_references.update({
      where: {
        reference_id: referenceId,
      },
      data: {
        status: "rejected",
      },
    });

    // Notify contributor
    if (reference.created_by) {
      await prisma.notifications.create({
        data: {
          user_id: reference.created_by,
          type: "REFERENCE_REJECTED",
          message: `Your reference "${reference.title || "reference"}" was rejected.${reason ? ` Reason: ${reason}` : ""}`,
          related_entity: `reference:${referenceId}`,
          is_read: false,
          created_at: new Date(),
        },
      });
    }

    return res.json({
      success: true,
      message: "Reference rejected",
      data: updated,
      reason: reason || null,
    });

  } catch (error) {
    console.error("rejectReference error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


exports.getPendingReferences = async (req, res) => {
  try {
    const pending = await prisma.scholar_references.findMany({
      where: {
        status: "pending",
      },
       include: {
  scholar_versions: {
    include: {
      scholars: true,
      languages: true,
    },
  },

  users: {
    select: {
      id: true,
      username: true,
      email: true,
    },
  },
},
      orderBy: {
        reference_id: "asc",
      },
    });

    res.json({
      success: true,
      data: pending,
    });
  } catch (error) {
    console.error("getPendingReferences error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};