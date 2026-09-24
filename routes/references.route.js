// routes/references.route.js
const express = require("express");
const router = express.Router();

const {
  createReference,
  getScholarReferences,
  updateReference,
  deleteReference,
} = require("../controllers/references.controller");

// ✅ 1. Import BOTH middlewares
const protect = require("../middlewares/auth.middleware");
const optionalAuth = require("../middlewares/optionalAuth.middleware");

// ── READ: Anyone can view scholar references (Guests or Logged-in) ──
router.get("/:version_id", optionalAuth, getScholarReferences);

// ── WRITES: Must be logged in, NOT banned, AND allowed to contribute ──
router.post("/", protect, protect.checkContributionAccess, createReference);
router.put("/:id", protect, protect.checkContributionAccess, updateReference);
router.delete("/:id", protect, protect.checkContributionAccess, deleteReference);

module.exports = router;