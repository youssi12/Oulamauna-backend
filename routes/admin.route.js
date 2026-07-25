const express = require("express");
const router = express.Router();

const { getAllUsers, getUserById, banUser, unbanUser } = require("../controllers/user.controller");
const { approveMedia,rejectMedia,deleteMedia} = require("../controllers/mediaUpload.controller");
const scholarManagement = require("../controllers/scholarManagement.controller")

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
    router.put("/media/:id/approve", approveMedia);
    router.put("/media/:id/reject", rejectMedia);
    router.delete("/media/:id",   deleteMedia);


// refrences 
 
module.exports = router;