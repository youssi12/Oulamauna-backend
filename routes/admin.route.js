const express = require("express");
const router = express.Router();

const { getAllUsers, getUserById, banUser, unbanUser } = require("../controllers/user.controller");
const { approveMedia,rejectMedia,deleteMedia,getPendingMedia} = require("../controllers/mediaUpload.controller");
const scholarManagement = require("../controllers/scholarManagement.controller")
const {updateRegion,deleteRegion,} = require("../controllers/region.controller");
const {updateDiscipline,deleteDiscipline} = require("../controllers/discipline.controller");
const {approveReference,rejectReference,getPendingReferences,} = require("../controllers/references.controller")
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

// scholars Publications management
    router.get("/scholars/pending/created",scholarManagement.getPendingCreatedScholars)
    router.get("/scholars/pending/edited",scholarManagement.getPendingEditedScholars)
    router.put("/scholars/:id/approve",scholarManagement.approveScholar);
    router.put("/scholars/:id/reject",scholarManagement.rejectScholar); 
       //*? get all the Vs of a scholar page(u can specify the lang)*/
    router.get("/scholars/:id/versions",scholarManagement.getScholarVersions);
    router.get("/scholars/states",scholarManagement.getDashboardStats)
 
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

//  discipline managemnet
router.put("/discipline/:id",   updateDiscipline);
router.delete("/discipline/:id",   deleteDiscipline);


// regions management
router.put("/region/:id",  updateRegion);
router.delete("/region/:id", deleteRegion);


 
module.exports = router;