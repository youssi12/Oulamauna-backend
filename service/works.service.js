const prisma = require("../config/db");
const WORK_FORMATS = new Set([
  "BOOK",
  "ARTICLE",
  "TREATISE",
  "MANUSCRIPT",
  "LECTURE",
  "SERMON",
  "FATWA",
  "POEM",
  "LETTER",
  "COMMENTARY",
  "TRANSLATION",
  "RESEARCH",
  "COURSE",
  "DEVICE",
  "INVENTION",
  "SOFTWARE",
  "MAP",
  "OTHER",
]);



exports.createWorkService = async ({
  version_id,
  title,
  year,
  format,
  description,
  media_url,
  file,
  created_by,
}) => {

   if (!WORK_FORMATS.has(format)) {
  throw new Error(
    `Invalid work format. Allowed formats: ${[...WORK_FORMATS].join(", ")}`
  );
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
    throw new Error("This version has been superseded or rejected — use the currently approved version_id.");
  }
  if (version.status === "pending" && version.version_type === "edition") {
    throw new Error("This version is a pending edit with no content of its own yet — use the currently approved version_id.");
  }

  if (file && media_url) {
    throw new Error("Provide either a file or a media_url, not both");
  }

  let workData = {
    version_id: parseInt(version_id),
    title,
    year: year ? parseInt(year) : null,
    format,
    description: description || null,
    created_by: created_by,
  };

  if (file) {
    workData.file_name = file.originalname;
    workData.file_path = file.path;
    workData.source_type = "upload";
  }

  if (media_url) {
    workData.media_url = media_url;
    workData.source_type = "external";
  }

  return prisma.scholar_works.create({
    data: workData,
  });
};