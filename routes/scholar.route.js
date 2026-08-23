const express = require("express");
const router = express.Router();

const scholarPage = require("../controllers/scholarPage.controller");
const protect = require("../middlewares/auth.middleware");
const { uploadScholarBundle } = require("../config/cloudinary");

// Create
router.post("/", protect, uploadScholarBundle.any(), scholarPage.createScholar);

// Read
router.get("/", scholarPage.getPublishedScholars);          
router.get("/name", scholarPage.getScholarByName);        
router.get("/my-submissions", protect, scholarPage.getMySubmissions);
router.get("/:id", scholarPage.getScholarById);             

// Update
router.patch("/:id", protect, scholarPage.editScholar);

// ✅ ADD THIS: Relationships endpoint
router.post("/relationships", protect, scholarPage.addScholarRelationship);

module.exports = router;