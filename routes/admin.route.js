const express = require("express");
const router = express.Router();

const { getAllUsers, getUserById, banUser, unbanUser, getUserContributions, getUserForumPosts } = require("../controllers/user.controller");

// ✅ UPDATED: Added getAllMediaSummary
const { approveMedia, rejectMedia, deleteMedia, getPendingMedia, getAllMediaSummary } = require("../controllers/media.controller");

const scholarManagement = require("../controllers/scholarManagement.controller");
const forumController = require("../controllers/Forum.controller");
const { updateRegion, deleteRegion } = require("../controllers/region.controller");
const { updateDiscipline, deleteDiscipline, uploadDisciplineImage } = require("../controllers/discipline.controller");
const { uploadDisciplineImage: uploadDisciplineMiddleware } = require("../config/cloudinary");

const { approveReference, rejectReference, getPendingReferences } = require("../controllers/references.controller");

// ✅ UPDATED: Added getAllWorksSummary
const { approveWork, rejectWork, getPendingWorks, toggleWorkFeature, getAllWorksSummary } = require("../controllers/works.controller");

const { approveScholarImage, rejectScholarImage, getPendingScholarImages } = require("../controllers/scholarImage.controller");
const contactusController = require("../controllers/contactus.controller");

// middlewares 
const protect = require("../middlewares/auth.middleware");
const adminOnly = require("../middlewares/admin.middleware");

router.use(protect, adminOnly);

// ==========================================
// USERS MANAGEMENT
// ==========================================
router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.patch("/users/:id/ban", banUser);
router.patch("/users/:id/unban", unbanUser);
router.patch("/users/:id/contribute", scholarManagement.toggleContributePermission);
router.get("/users/:id/contributions", getUserContributions);
router.get("/users/:id/posts", getUserForumPosts);

// ==========================================
// SCHOLARS PUBLICATIONS MANAGEMENT
// ==========================================
router.get("/scholars/pending/created", scholarManagement.getPendingCreatedScholars);
router.get("/scholars/pending/edited", scholarManagement.getPendingEditedScholars);
router.put("/scholars/:id/approve", scholarManagement.approveScholar);
router.put("/scholars/:id/reject", scholarManagement.rejectScholar); 
router.get("/scholars/all", scholarManagement.getAllScholarsSummary);
router.patch('/scholars/:id/feature', scholarManagement.toggleScholarFeature);
router.get('/scholars/:id/:lang', scholarManagement.getScholarVersionDetail);
router.get("/scholars/states", scholarManagement.getDashboardStats);
router.get("/dashboard/data", scholarManagement.getDashboardData);

// ==========================================
// FORUM MANAGEMENT
// ==========================================
router.get("/posts", forumController.getAdminPosts);
router.get('/posts/:id', forumController.getAdminPostById);
router.put("/posts/:id/hide", forumController.hidePost);
router.put("/posts/:id/restore", forumController.restorePost);           
router.delete("/posts/:id", forumController.deletePostPermanently);       

router.put("/comments/:id/hide", forumController.hideComment);           
router.put("/comments/:id/restore", forumController.restoreComment);     
router.delete("/comments/:id", forumController.deleteCommentPermanently); 

router.get("/reports/pending", forumController.getPendingReports);
router.post("/reports/resolve", forumController.resolveReport);

// Categories
router.get("/categories", forumController.getCategories);
router.post("/categories", forumController.createCategory);
router.put("/categories/reorder", forumController.reorderCategories);
router.put("/categories/:id", forumController.updateCategory);
router.delete("/categories/:id", forumController.deleteCategory);

// ==========================================
// MEDIA MANAGEMENT
// ==========================================
router.get("/media/summary", getAllMediaSummary); // ✅ ADDED: For All Media Page
router.get("/media/pending", getPendingMedia);
router.put("/media/:id/approve", approveMedia);
router.put("/media/:id/reject", rejectMedia);
router.delete("/media/:id", deleteMedia);

// ==========================================
// REFERENCES MANAGEMENT
// ==========================================
router.get("/reference/pending", getPendingReferences);
router.put("/reference/:id/approve", approveReference);
router.put("/reference/:id/reject", rejectReference); 

// ==========================================
// WORKS MANAGEMENT
// ==========================================
router.get("/work/summary", getAllWorksSummary); // ✅ ADDED: For All Works Page
router.get("/work/pending", getPendingWorks);
router.put("/work/:id/approve", approveWork);
router.put("/work/:id/reject", rejectWork);
router.patch('/work/:id/feature', toggleWorkFeature);

// ==========================================
// SCHOLAR IMAGES MANAGEMENT
// ==========================================
router.get("/img/pending", getPendingScholarImages);
router.put("/img/:id/approve", approveScholarImage);
router.put("/img/:id/reject", rejectScholarImage);

// ==========================================
// DISCIPLINE MANAGEMENT
// ==========================================
router.put("/discipline/:id/image", uploadDisciplineMiddleware.single("image"), uploadDisciplineImage);
router.put("/discipline/:id", updateDiscipline);
router.delete("/discipline/:id", deleteDiscipline);

// ==========================================
// REGIONS MANAGEMENT
// ==========================================
router.put("/region/:id", updateRegion);
router.delete("/region/:id", deleteRegion);

// ==========================================
// CONTACT US MANAGEMENT (Admin Only)
// ==========================================
router.get("/contactus", contactusController.getAllMessages);
router.get("/contactus/:id", contactusController.getMessageById);
router.post("/contactus/:id/reply", contactusController.replyToMessage);
router.patch("/contactus/:id/archive", contactusController.archiveMessage);

module.exports = router;