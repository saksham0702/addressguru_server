import express from "express";
import {
  getConfig,
  addOption,
  updateOption,
  deleteOption,
  reorderOptions,
} from "../controller/followUp.Controller.js";

const router = express.Router();

// GET    /api/followup-config/:module
router.get("/:module", getConfig);

// POST   /api/followup-config/:module/option
router.post("/:module/option", addOption);

// PUT    /api/followup-config/:module/option/:optionId
router.put("/:module/option/:optionId", updateOption);

// DELETE /api/followup-config/:module/option/:optionId
router.delete("/:module/option/:optionId", deleteOption);

// PUT    /api/followup-config/:module/reorder
router.put("/:module/reorder", reorderOptions);

export default router;