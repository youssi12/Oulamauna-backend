const express = require("express");
const router = express.Router();

const { upload } = require("../config/cloudinary");
const { createWork } = require("../controllers/works.controller");

const protect = require("../middlewares/auth.middleware");

router.use(protect);

router.post("/", upload.single("file"), createWork);

module.exports = router;