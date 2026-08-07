const prisma = require("../config/db");

exports.createReferenceService = async ({
  version_id,
  title,
  citation,
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

  if (!title && !citation && !url) {
    throw new Error("At least one of title, citation, or url is required");
  }

  return prisma.scholar_references.create({
    data: {
      version_id: parseInt(version_id),
      title: title || null,
      citation: citation || null,
      url: url || null,
    },
  });
};