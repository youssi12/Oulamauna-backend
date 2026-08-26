const express = require("express");
const router = express.Router();
const { getAllLanguages } = require("../controllers/language.controller");

// ✅ Route to get all languages
router.get("/", getAllLanguages);

module.exports = router;