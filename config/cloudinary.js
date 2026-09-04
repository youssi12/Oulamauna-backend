const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ------------------------------------------------------
// Generic Cloudinary storage
// ------------------------------------------------------

const createStorage = (folder, allowedFormats) =>
  new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      let resource_type = "raw";

      if (file.mimetype.startsWith("audio")) {
        resource_type = "video"; // Cloudinary stores audio as video
      } else if (file.mimetype.startsWith("video")) {
        resource_type = "video";
      } else if (file.mimetype.startsWith("image")) {
        resource_type = "image";
      }

      return {
        folder,
        resource_type,
        allowed_formats: allowedFormats,
      };
    },
  });

// ------------------------------------------------------
// Generic multer uploader
// ------------------------------------------------------

const createUploader = (folder, allowedFormats, allowedMimeTypes) =>
  multer({
    storage: createStorage(folder, allowedFormats),

    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
    },

    fileFilter: (req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("File type not allowed"), false);
      }
    },
  });

// ------------------------------------------------------
// Shared document/audio/video types
// ------------------------------------------------------

const documentFormats = [
  "pdf",
  "mp3",
  "wav",
  "ogg",
  "mp4",
  "webm",
];

const documentMimeTypes = [
  "application/pdf",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "video/mp4",
  "video/webm",
];

// ------------------------------------------------------
// Image types
// ------------------------------------------------------

const imageFormats = [
  "jpg",
  "jpeg",
  "png",
  "webp",
];

const imageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

// ------------------------------------------------------
// Uploaders
// ------------------------------------------------------

const uploadWorks = createUploader(
  "oulamauna/works",
  documentFormats,
  documentMimeTypes
);

const uploadMedia = createUploader(
  "oulamauna/media",
  documentFormats,
  documentMimeTypes
);

const uploadScholarImage = createUploader(
  "oulamauna/scholar-images",
  imageFormats,
  imageMimeTypes
);

const uploadProfilePicture = createUploader(
  "oulamauna/profile-pictures",
  imageFormats,
  imageMimeTypes
);

// ------------------------------------------------------
// Combined uploader for createScholar (dynamic field names)
// ------------------------------------------------------
// Unlike uploadWorks/uploadMedia/uploadScholarImage (fixed folder + fixed
// field name each), this one inspects file.fieldname per file and routes
// it to the right folder/resource_type — needed because createScholar
// accepts an arbitrary number of dynamically-named files in one request
// (image, work_file_0, work_file_1, media_file_0, ...).

const scholarBundleStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = "oulamauna/misc";
    let resource_type = "raw";

    if (file.fieldname === "image") {
      folder = "oulamauna/scholar-images";
      resource_type = "image";
    } else if (file.fieldname.startsWith("work_file")) {
      folder = "oulamauna/works";
      resource_type = file.mimetype.startsWith("audio") || file.mimetype.startsWith("video")
        ? "video"
        : "raw";
    } else if (file.fieldname.startsWith("media_file")) {
      folder = "oulamauna/media";
      resource_type = file.mimetype.startsWith("audio") || file.mimetype.startsWith("video")
        ? "video"
        : "raw";
    }

    return { folder, resource_type };
  },
});

const uploadScholarBundle = multer({
  storage: scholarBundleStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // image field must actually be an image; work/media fields accept
    // the same document/audio/video types as your existing uploaders
    if (file.fieldname === "image") {
      return cb(imageMimeTypes.includes(file.mimetype) ? null : new Error("Profile image must be jpg/png/webp"), imageMimeTypes.includes(file.mimetype));
    }
    if (file.fieldname.startsWith("work_file") || file.fieldname.startsWith("media_file")) {
      return cb(documentMimeTypes.includes(file.mimetype) ? null : new Error("File type not allowed"), documentMimeTypes.includes(file.mimetype));
    }
    cb(new Error(`Unexpected field: ${file.fieldname}`), false);
  },
});

// ------------------------------------------------------
// Exports
// ------------------------------------------------------

module.exports = {
  cloudinary,
  uploadWorks,
  uploadMedia,
  uploadScholarImage,
  uploadScholarBundle,
  uploadProfilePicture
};