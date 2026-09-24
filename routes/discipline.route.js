const express = require("express");
const router = express.Router();

const { createDiscipline, getAllDisciplines } = require("../controllers/discipline.controller");

// ✅ 1. Import the middlewares
const protect = require("../middlewares/auth.middleware");
const optionalAuth = require("../middlewares/optionalAuth.middleware");

// ── READ: Anyone can view the list of disciplines ──
router.get("/", optionalAuth, getAllDisciplines);

// ── WRITE: Must be logged in, NOT banned, AND allowed to contribute ──
// (Note: If ONLY admins should create disciplines, change this to: protect, adminOnly)
router.post("/", protect, protect.checkContributionAccess, createDiscipline);

module.exports = router;