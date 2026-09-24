const express = require("express");
const router = express.Router();

const protect = require("../middlewares/auth.middleware");

const {
  uploadScholarImage,
} = require("../controllers/scholarImage.controller");

const {
  uploadScholarImage: uploadScholarImageMiddleware,
} = require("../config/cloudinary");

// ✅ Apply protection and contribution check directly to the route
router.post(
  "/",
  protect,                        // 1. Ensure the user is logged in
  protect.checkContributionAccess, // 2. Ensure they have permission to contribute (not banned/revoked)
  uploadScholarImageMiddleware.single("image"), // 3. Upload the file to Cloudinary
  uploadScholarImage              // 4. Save the data to the database
);

module.exports = router;