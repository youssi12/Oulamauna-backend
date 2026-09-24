const express = require("express");
const router = express.Router();
const homeController = require("../controllers/home.controller");

// ✅ Import the optionalAuth middleware
const optionalAuth = require("../middlewares/optionalAuth.middleware");

// ✅ GET /api/home -> Anyone can view, but logged-in users get personalized data
router.get("/", optionalAuth, homeController.getHomeData);

// ✅ If you have a separate search route, it also uses optionalAuth
// router.get("/search", optionalAuth, homeController.searchHomeData);

module.exports = router;