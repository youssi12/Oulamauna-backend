// routes/regions.route.js

const express = require("express");
const router = express.Router();

const {
  createRegion,
  getAllRegions,
   
} = require("../controllers/region.controller");

const protect = require("../middlewares/auth.middleware");

 
router.get("/",protect, getAllRegions);

// ── Create: any logged-in user, admins get notified ──
router.post("/", protect, createRegion);

 


module.exports = router;