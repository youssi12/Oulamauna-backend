const prisma = require("../config/db");

exports.createReferenceService = async ({
  version_id,
  title,
  citation,
  created_by,
  url,
}) => {
  const version = await prisma.scholar_versions.findUnique({
    where: {
      version_id: parseInt(version_id),
    },
  });

  if (!version) {
    throw new Error("Scholar version not found");
  }

  if (version.status === "superseded") {
    throw new Error("This version has been superseded — use the currently approved version_id.");
  }
  if (version.status === "pending" && version.version_type === "edition") {
    throw new Error("This version is a pending edit with no content of its own yet — use the currently approved version_id.");
  }

  if (!title && !citation && !url) {
    throw new Error("At least one of title, citation, or url is required");
  }

  return prisma.scholar_references.create({
    data: {
      version_id: parseInt(version_id),
      title: title || null,
      citation: citation || null,
      url: url || null,
      created_by: created_by,
    },
  });
};