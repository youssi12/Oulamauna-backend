const prisma = require("../config/db");

const uploadScholarImageService = async ({
  version_id,
  file,
  uploaded_by,
}) => {
   
  if (!version_id) {
    throw new Error("version_id is required");
  }

  if (!file) {
    throw new Error("Image is required");
  }

  if (!uploaded_by) {
    throw new Error("uploaded_by is required");
  }

  const version = await prisma.scholar_versions.findUnique({
    where: {
      version_id: parseInt(version_id),
    },
  });

  if (!version) {
    throw new Error("Scholar version not found");
  }

  if (version.status === "superseded" || version.status === "rejected") {
    throw new Error(
      "This version has been superseded or rejected — use the currently approved version_id."
    );
  }

  

  const imageVersion = await prisma.img_versions.create({
    data: {
      version_id: parseInt(version_id),
      image_url: file.path,
      status: "pending",
      uploaded_by,
      created_at: new Date(),
    },
  });

  return imageVersion;
};

module.exports = {
  uploadScholarImageService,
};