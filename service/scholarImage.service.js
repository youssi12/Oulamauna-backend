const prisma = require("../config/db");

const uploadScholarImageService = async ({ version_id, file }) => {
  if (!version_id) {
    throw new Error("version_id is required");
  }

  if (!file) {
    throw new Error("Image is required");
  }

  const version = await prisma.scholar_versions.findUnique({
    where: {
      version_id: parseInt(version_id),
    },
  });

  if (!version) {
    throw new Error("Scholar version not found");
  }

  const updatedVersion = await prisma.scholar_versions.update({
    where: {
      version_id: parseInt(version_id),
    },
    data: {
      image_url: file.path,
      image_status: "pending",
    },
  });

  return updatedVersion;
};

module.exports = {
  uploadScholarImageService,
};