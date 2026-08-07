// routes/references.route.js

const express = require("express");
const router = express.Router();

const {
  createReference,
  getScholarReferences,
  updateReference,
  deleteReference,
} = require("../controllers/refrences.controller");

const protect = require("../middlewares/auth.middleware");

// //? ── Public read ──
router.get("/:version_id", getScholarReferences);

// ── Writes require login (ownership/admin enforced in controller) ──
router.post("/", protect, createReference);
router.put("/:id", protect, updateReference);
router.delete("/:id", protect, deleteReference);

module.exports = router;