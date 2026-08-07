const express = require("express");
const router = express.Router();

const {createDiscipline,getAllDisciplines } = require("../controllers/discipline.controller");
const protect = require("../middlewares/auth.middleware");

router.get("/", getAllDisciplines);
 
router.use(protect);
router.post("/", createDiscipline);


module.exports = router;