import express from "express";
import {
  createFollowUp,
  getFollowUpsByListing,
  getFollowUpById,
  deleteFollowUp,
} from "../controller/followUp.Controller.js";
import { authenticate } from "../middleware/userAuth.js"; 

const router = express.Router();

// POST   /api/followups
router.post("/", authenticate, createFollowUp);

// GET    /api/followups/listing/:listingId
router.get("/listing/:listingId", authenticate, getFollowUpsByListing);

// GET    /api/followups/:id
router.get("/:id", getFollowUpById);

// DELETE /api/followups/:id
router.delete("/:id", deleteFollowUp);

export default router;
