const express = require("express");
const router = express.Router();

const { uploadWorks} = require("../config/cloudinary");
const { createWork } = require("../controllers/works.controller");

const protect = require("../middlewares/auth.middleware");

router.use(protect);

router.post("/", uploadWorks.single("file"), createWork);

module.exports = router;