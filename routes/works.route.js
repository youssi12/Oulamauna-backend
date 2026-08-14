const express = require("express");
const router = express.Router();

const { uploadWorks} = require("../config/cloudinary");
const { createWork,updateWork,getScholarWorks} = require("../controllers/works.controller");

const protect = require("../middlewares/auth.middleware");

router.use(protect);

router.get("/:version_id",getScholarWorks)
router.post("/", uploadWorks.single("file"), createWork);
router.put("/:workId",updateWork);

module.exports = router;