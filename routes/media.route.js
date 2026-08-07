// routes/media.routes.js

const express = require("express");
const router = express.Router();

const {
  uploadMedia,
  getScholarMedia,
  approveMedia,
  rejectMedia,
  deleteMedia,
} = require("../controllers/mediaUpload.controller");

const {
  uploadMedia: uploadMediaMiddleware,
} = require("../config/cloudinary");

const protect = require("../middlewares/auth.middleware");

router.use(protect);

// Upload a file OR submit an external URL
router.post(
  "/",
  uploadMediaMiddleware.single("file"),
  uploadMedia
);

// Get approved media for a scholar
router.get("/:version_id", getScholarMedia);

 
module.exports = router;