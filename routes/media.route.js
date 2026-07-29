// routes/media.routes.js
const express = require("express");
const router = express.Router();
const { upload } = require("../config/cloudinary");
const {uploadMedia,getScholarMedia} = require("../controllers/mediaUpload.controller");

// middleware 
   const  protect = require("../middlewares/auth.middleware");
   router.use(protect)


// routes
    router.get("/:scholar_id", getScholarMedia);  
    router.post("/upload", upload.single("file"), uploadMedia);
    router.post("/link", uploadMedia);




module.exports = router;