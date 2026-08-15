const express = require("express");
const router = express.Router();

const protect = require("../middlewares/auth.middleware");

const {
  uploadScholarImage,
} = require("../controllers/scholarImage.controller");

const {
  uploadScholarImage: uploadScholarImageMiddleware,
} = require("../config/cloudinary");

router.use(protect);

router.post(
  "/",
  uploadScholarImageMiddleware.single("image"),
  uploadScholarImage
);

module.exports = router;