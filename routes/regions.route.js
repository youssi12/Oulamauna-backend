// routes/regions.route.js

const express = require("express");
const router = express.Router();

const {
  createRegion,
  getAllRegions,
   
} = require("../controllers/region.controller");

const protect = require("../middlewares/auth.middleware");
// ASSUMPTION: your admin.middleware.js exports a function under some name —
// adjust `isAdmin` below to match its actual export (e.g. it might be
// `module.exports = requireAdmin` or `{ isAdmin }`).
const isAdmin = require("../middlewares/admin.middleware");

// ── Public reads ──
router.get("/", getAllRegions);

// ── Create: any logged-in user, admins get notified ──
router.post("/", protect, createRegion);

 


module.exports = router;