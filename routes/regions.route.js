// routes/regions.route.js
const express = require("express");
const router = express.Router();

const {
  createRegion,
  getAllRegions,
} = require("../controllers/region.controller");

// ✅ 1. Import BOTH middlewares
const protect = require("../middlewares/auth.middleware");
const optionalAuth = require("../middlewares/optionalAuth.middleware");

// ── READ: Anyone can view the list of regions (Guests need this to filter scholars) ──
router.get("/", optionalAuth, getAllRegions);

// ── WRITE: Must be logged in, NOT banned, AND allowed to contribute ──
// (This prevents revoked users from spamming new regions, even if "any logged-in user" can do it)
router.post("/", protect, protect.checkContributionAccess, createRegion);

module.exports = router;