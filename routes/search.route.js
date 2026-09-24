const express = require("express");
const router = express.Router();
const searchController = require("../controllers/search.controller");

// ✅ Import the optionalAuth middleware
const optionalAuth = require("../middlewares/optionalAuth.middleware");

// ✅ GET /api/search -> Anyone can search, logged-in users get personalized data
router.get("/", optionalAuth, searchController.globalSearch);

module.exports = router;