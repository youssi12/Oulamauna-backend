const express = require("express");
const router = express.Router();
const rolesController = require("../controllers/role.controller");

// ✅ Public route to get roles (needed by frontend to check admin status)
router.get("/", rolesController.getRoles);

module.exports = router;