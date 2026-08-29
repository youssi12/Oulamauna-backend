const prisma = require("../config/db");

exports.uploadMediaService = async ({
  version_id,
  title,
  year,
  description,
  media_url,
  file,
  userId,
}) => {
  const version = await prisma.scholar_versions.findUnique({
    where: {
      version_id: parseInt(version_id),
    },
  });

  if (!version) {
    throw new Error("Scholar version not found");
  }

  // FIX: block attaching new media to a dead/inactive version.
  // - "superseded" versions are dead history — nothing should attach here.
  // - a "pending" version of type "edition" owns no content by design
  //   (see approveScholar reassignment) — attach to the current approved
  //   version instead.
  // A "pending" version of type "creation" IS allowed — that's the initial
  // submission flow (createScholar attaching works/media/refs/image before
  // the whole thing is ever approved).
  if (version.status === "superseded" || version.status === "rejected") {
    throw new Error("This version has been superseded or rejected — use the currently approved version_id.");
  }
  if (version.status === "pending" && version.version_type === "edition") {
    throw new Error("This version is a pending edit with no content of its own yet — use the currently approved version_id.");
  }

  if (file && media_url) {
    throw new Error("Provide either a file or a media_url, not both");
  }

  if (!file && !media_url) {
    throw new Error("Provide either a file or a media_url");
  }

  let mediaData = {
    version_id: parseInt(version_id),
    title: title || null,
    year: year ? parseInt(year) : null,
    description: description || null,

    status: "pending",
    uploaded_by: userId,
    uploaded_at: new Date(),
    view_count: 0,
    like_count: 0,
  };

  if (file) {
    const typeMap = {
      "application/pdf": "pdf",
      "audio/mpeg": "audio",
      "audio/wav": "audio",
      "audio/ogg": "audio",
      "video/mp4": "video",
      "video/webm": "video",
    };

    mediaData = {
      ...mediaData,
      file_name: file.originalname,
      file_path: file.path,
      file_type: typeMap[file.mimetype] || "pdf",
      source_type: "upload",
    };
  }    else {
    // ✅ For external links, file_type should be NULL
    mediaData = {
      ...mediaData,
      media_url,
      file_type: null,  // ✅ CORRECT - it's a link, not a file!
      file_path: null,  // ✅ Also NULL for links
      file_name: null,  // ✅ Also NULL for links
      source_type: "external",
    };
  }

  return prisma.media.create({
    data: mediaData,
  });
};