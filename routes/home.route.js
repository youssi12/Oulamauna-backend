const express = require("express");
const router = express.Router();
const homeController = require("../controllers/home.controller");

// GET /api/home  ->  everything the Home page needs in one call
router.get("/", homeController.getHomeData);

module.exports = router;