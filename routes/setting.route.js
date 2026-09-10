const express = require("express");
const router = express.Router();

const settings = require("../controllers/setting.controller");
const protect = require("../middlewares/auth.middleware");

router.use(protect);

router.get("/", settings.getMySettings);
router.patch("/", settings.updateMySettings);
router.post("/deactivate", settings.deactivateAccount);
router.post("/delete", settings.deleteAccount);

module.exports = router;