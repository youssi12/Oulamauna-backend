// routes/references.route.js

const express = require("express");
const router = express.Router();

const {
  createReference,
  getScholarReferences,
  updateReference,
  deleteReference,
} = require("../controllers/references.controller");

const protect = require("../middlewares/auth.middleware");
 
router.get("/:version_id",protect,getScholarReferences);
router.post("/", protect, createReference);
router.put("/:id", protect, updateReference);
router.delete("/:id", protect, deleteReference);


module.exports = router;