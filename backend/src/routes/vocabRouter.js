const express = require("express");
const router = express.Router();

const vocabularyController =
require("../controllers/vocabularyController");

router.post("/", vocabularyController.createVocabulary);

router.get("/", vocabularyController.getAllVocabulary);

router.get("/:id",
vocabularyController.getVocabularyById);

router.put("/:id",
vocabularyController.updateVocabulary);

router.delete("/:id",
vocabularyController.deleteVocabulary);

module.exports = router;
