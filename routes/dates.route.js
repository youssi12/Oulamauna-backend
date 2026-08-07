// routes/dates.route.js

const express = require("express");
const router = express.Router();

const {
  createDate,
  getScholarDates,
  updateDate,
  deleteDate,
} = require("../controllers/date.controller");

const protect = require("../middlewares/auth.middleware");

// ── Public read ──
router.get("/:version_id", getScholarDates);

// ── Writes require login (ownership/admin enforced in controller) ──
router.post("/", protect, createDate);
router.put("/:id", protect, updateDate);
router.delete("/:id", protect, deleteDate);

module.exports = router;