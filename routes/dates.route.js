// routes/dates.route.js
const express = require("express");
const router = express.Router();

const {
  createDate,
  getScholarDates,
  updateDate,
  deleteDate,
} = require("../controllers/date.controller");

// ✅ 1. Import both middlewares
const protect = require("../middlewares/auth.middleware");
const optionalAuth = require("../middlewares/optionalAuth.middleware"); // Your visitor middleware

// ── READ: Anyone can view scholar dates (Guests or Logged-in) ──
router.get("/:version_id", optionalAuth, getScholarDates);

// ── WRITES: Must be logged in, NOT banned, AND allowed to contribute ──
router.post("/", protect, protect.checkContributionAccess, createDate);
router.put("/:id", protect, protect.checkContributionAccess, updateDate);
router.delete("/:id", protect, protect.checkContributionAccess, deleteDate);

module.exports = router;