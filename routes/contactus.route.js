const express = require("express");
const router = express.Router();
const contactusController = require("../controllers/contactus.controller");

// PUBLIC ROUTE: Anyone can submit a contact form
// POST /api/contactus
router.post("/", contactusController.submitContactForm);

module.exports = router;