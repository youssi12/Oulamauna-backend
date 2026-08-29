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

// ✅ DRAFT SYSTEM — must stay ABOVE "/:id" or Express will treat
// "drafts"/"draft" as a scholar_id param and call getScholarById instead.
router.post("/draft", protect, scholarPage.saveDraft);
router.get("/drafts", protect, scholarPage.getMyDrafts);
router.get("/draft/:versionId", protect, scholarPage.getDraftById);
router.delete("/draft/:versionId", protect, scholarPage.deleteDraft);
router.post("/draft/:versionId/submit", protect, scholarPage.submitDraft);
router.get("/version/:versionId", protect, scholarPage.getVersionById);


router.get("/:id", scholarPage.getScholarById);             

// Update
router.patch("/:id", protect, uploadScholarBundle.any(), scholarPage.editScholar);

// ✅ ADD THIS: Relationships endpoint
router.post("/relationships", protect, scholarPage.addScholarRelationship);

// ✅ NEW: Dedicated routes for REJECTED versions (Must be ABOVE /:id)
router.put("/rejected/:versionId", protect, scholarPage.updateRejectedVersion);
router.delete("/rejected/:versionId", protect, scholarPage.deleteRejectedVersion);

module.exports = router;