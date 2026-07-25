const express = require("express");
const router = express.Router();

const scholarPage= require("../controllers/scholarPage.controller");

// middleware
   const protect = require("../middlewares/auth.middleware");
   router.use(protect)



// routes
   router.post("/",scholarPage.createScholar)
   router.get("/",scholarPage.getPublishedScholars);//alwyas give it langugae 
   router.get("/my-submissions",scholarPage.getMySubmissions);
   router.get("/:id", scholarPage.getScholarById); 
   router.put("/:id", scholarPage.editScholar)
   

module.exports = router;