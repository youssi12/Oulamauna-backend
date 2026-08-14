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

 


// ── Writes require login (ownership/admin enforced in controller) ──
router.get("/:version_id",protect, getScholarDates);
router.post("/", protect, createDate);
router.put("/:id", protect, updateDate);
router.delete("/:id", protect, deleteDate);

module.exports = router;