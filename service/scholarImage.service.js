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

  // FIX: matches the same two-condition guard used in media/works/references
  // services — a blanket "must be approved" check would have broken
  // createScholar's own image upload, since that happens on a freshly
  // created "pending"/"creation" version, before anything is approved.
  if (version.status === "superseded") {
    throw new Error("This version has been superseded — use the currently approved version_id.");
  }
  if (version.status === "pending" && version.version_type === "edition") {
    throw new Error("This version is a pending edit with no content of its own yet — use the currently approved version_id.");
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