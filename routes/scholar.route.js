 const express = require("express");
const router = express.Router();

const scholarPage = require("../controllers/scholarPage.controller");
const protect = require("../middlewares/auth.middleware");
const { uploadScholarBundle } = require("../config/cloudinary");
router.use(protect);

// Create
router.post("/",uploadScholarBundle.any(), scholarPage.createScholar);

// Read
router.get("/", scholarPage.getPublishedScholars);          // List + filters
router.get("/search", scholarPage.getScholarByName);        // Search by name/alias
router.get("/my-submissions", scholarPage.getMySubmissions);
router.get("/:id", scholarPage.getScholarById);             // Single scholar

// Update
router.put("/:id", scholarPage.editScholar);

module.exports = router;