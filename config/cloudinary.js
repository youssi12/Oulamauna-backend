const cloudinary = require("cloudinary").v2;   // ← .v2 added
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
  let resource_type;

  if (file.mimetype === "application/pdf") {
    resource_type = "raw";        // PDFs must be raw
  } else if (file.mimetype.startsWith("audio")) {
    resource_type = "video";      // Cloudinary stores audio under video
  } else if (file.mimetype.startsWith("video")) {
    resource_type = "video";
  } else {
    resource_type = "raw";
  }

  return {
    folder: "oulamauna/scholars",
    resource_type,
    allowed_formats: ["pdf", "mp3", "mp4", "wav", "ogg", "webm"],
  };
},
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "video/mp4",
      "video/webm",
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed"), false);
    }
  },
});

module.exports = { upload, cloudinary };