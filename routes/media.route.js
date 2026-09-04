// routes/media.routes.js

const express = require("express");
const router = express.Router();

const {
  uploadMedia,
  getScholarMedia,
  approveMedia,
  rejectMedia,
  deleteMedia,
  updateMedia,
  toggleMediaLike,
  registerMediaView
} = require("../controllers/media.controller");

const {
  uploadMedia: uploadMediaMiddleware,
} = require("../config/cloudinary");

const protect = require("../middlewares/auth.middleware");

router.post("/media/:id/view", registerMediaView);     

router.use(protect);

// Upload a file OR submit an external URL
router.post( "/",uploadMediaMiddleware.single("file"), uploadMedia);
// Update metadata
router.put("/:media_id",updateMedia);
// Get approved media for a scholar
router.get("/:version_id", getScholarMedia);
router.post("/media/:id/like",  toggleMediaLike);    
      

 
module.exports = router;