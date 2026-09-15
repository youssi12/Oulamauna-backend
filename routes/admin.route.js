const express = require("express");
const router = express.Router();

const { getAllUsers, getUserById, banUser, unbanUser, getUserContributions, getUserForumPosts } = require("../controllers/user.controller");
const { approveMedia,rejectMedia,deleteMedia,getPendingMedia} = require("../controllers/media.controller");
const scholarManagement = require("../controllers/scholarManagement.controller")
const forumController = require("../controllers/forum.controller");
const {updateRegion,deleteRegion,} = require("../controllers/region.controller");
const {updateDiscipline,deleteDiscipline} = require("../controllers/discipline.controller");
const {approveReference,rejectReference,getPendingReferences} = require("../controllers/references.controller")
const {approveWork,rejectWork,getPendingWorks} = require("../controllers/works.controller")
const {approveScholarImage,rejectScholarImage,getPendingScholarImages} = require("../controllers/scholarImage.controller")

// middlewares 
const protect = require("../middlewares/auth.middleware");
const adminOnly = require("../middlewares/admin.middleware");
    router.use(protect, adminOnly);

// users managemnet
    router.get("/users", getAllUsers);
    router.get("/users/:id", getUserById);
    router.patch("/users/:id/ban", banUser);
    router.patch("/users/:id/unban", unbanUser);
    router.patch("/users/:id/contribute",scholarManagement.toggleContributePermission)
router.get("/users/:id/contributions", getUserContributions);
router.get("/users/:id/posts", getUserForumPosts);
// scholars Publications management
    router.get("/scholars/pending/created",scholarManagement.getPendingCreatedScholars)
    router.get("/scholars/pending/edited",scholarManagement.getPendingEditedScholars)
    router.put("/scholars/:id/approve",scholarManagement.approveScholar);
    router.put("/scholars/:id/reject",scholarManagement.rejectScholar); 
   router.get("/scholars/all", scholarManagement.getAllScholarsSummary);
router.get("/scholars/:id/version-detail", scholarManagement.getScholarVersionDetail);
       //*? get all the Vs of a scholar page(u can specify the lang)*/
//! router.get("/scholars/:id/versions",scholarManagement.getScholarVersions);
    router.get("/scholars/states",scholarManagement.getDashboardStats)
 router.get("/dashboard/data", scholarManagement.getDashboardData);

 // forum management

router.get("/posts", forumController.getAdminPosts);
// should look like this:
router.get('/posts/:id',  forumController.getAdminPostById);
router.put("/posts/:id/hide", forumController.hidePost);
router.put("/posts/:id/restore", forumController.restorePost);           // ✅ new — undo hide
router.delete("/posts/:id", forumController.deletePostPermanently);       // now a real hard delete

router.put("/comments/:id/hide", forumController.hideComment);           // ✅ new
router.put("/comments/:id/restore", forumController.restoreComment);     // ✅ new
router.delete("/comments/:id", forumController.deleteCommentPermanently); // ✅ new
// Categories
router.get("/categories", forumController.getCategories);
router.post("/categories", forumController.createCategory);
router.put("/categories/reorder", forumController.reorderCategories);
router.put("/categories/:id", forumController.updateCategory);
router.delete("/categories/:id", forumController.deleteCategory);




// media management 
    router.get("/media/pending",getPendingMedia)
    router.put("/media/:id/approve", approveMedia);
    router.put("/media/:id/reject", rejectMedia);
    router.delete("/media/:id",   deleteMedia);

// references 
    router.get("/reference/pending",getPendingReferences)
    router.put("/reference/:id/approve", approveReference);
    router.put("/reference/:id/reject", rejectReference); 

// works 
    router.get("/work/pending",getPendingWorks)
    router.put("/work/:id/approve", approveWork);
    router.put("/work/:id/reject", rejectWork);
//img 
    router.get("/img/pending",getPendingScholarImages)
    router.put("/img/:id/approve", approveScholarImage);
    router.put("/img/:id/reject", rejectScholarImage);

// discipline managemnet
   router.put("/discipline/:id",   updateDiscipline);
   router.delete("/discipline/:id",   deleteDiscipline);


// regions management
router.put("/region/:id",  updateRegion);
router.delete("/region/:id", deleteRegion);


 
module.exports = router;