import express from "express";
import {
  createFollowUp,
  getFollowUpsByListing,
  getFollowUpById,
  deleteFollowUp,
  getConfig,
  addOption,
  updateOption,
  deleteOption,
  reorderOptions,
} from "../controller/followUp.Controller.js";

// import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

// POST   /api/followups                        → log a new follow-up
router.post("/", createFollowUp);

// GET    /api/followups/listing/:listingId     → all logs for one listing
router.get("/listing/:listingId", getFollowUpsByListing);

// GET    /api/followups/:id                    → single log detail
router.get("/:id", getFollowUpById);

// DELETE /api/followups/:id                    → admin delete a log
router.delete("/:id", deleteFollowUp);

// GET    /api/followup-config/:module          → load all options for modal
router.get("/:module",                          getConfig);

// POST   /api/followup-config/:module/option   → add new option
router.post("/:module/option",                  addOption);

// PUT    /api/followup-config/:module/option/:optionId → edit option
router.put("/:module/option/:optionId",         updateOption);

// DELETE /api/followup-config/:module/option/:optionId → delete option
router.delete("/:module/option/:optionId",      deleteOption);

// PUT    /api/followup-config/:module/reorder  → reorder
router.put("/:module/reorder",                  reorderOptions);



export default router;
