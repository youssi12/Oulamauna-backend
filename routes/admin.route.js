const express = require("express");
const router = express.Router();
const { getAllUsers, getUserById, banUser, unbanUser } = require("../controllers/user.controller");
const protect = require("../middlewares/auth.middleware");
const adminOnly = require("../middlewares/auth.middleware");

// both middlewares stack on every route
router.use(protect, adminOnly);

// users managemnet
router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.patch("/users/:id/ban", banUser);
router.patch("/users/:id/unban", unbanUser);



module.exports = router;