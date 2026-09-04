const express = require("express");
const router = express.Router();


const notification = require("../controllers/notification.controller");
const protect = require("../middlewares/auth.middleware")

router.get("/",protect,notification.getNotifications);
router.post("/All",protect,notification.markAllNotificationsRead);
router.post("/:id",protect,notification.markNotificationRead)



module.exports = router;
