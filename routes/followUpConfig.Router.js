import express from "express";
import {
  getConfig,
  addOption,
  updateOption,
  deleteOption,
  reorderOptions,
} from "../controller/followUp.Controller.js";

const router = express.Router();

router.get("/", getConfig);
router.post("/option", addOption);
router.put("/option/:optionId", updateOption);
router.delete("/option/:optionId", deleteOption);
router.put("/reorder", reorderOptions);

export default router;
