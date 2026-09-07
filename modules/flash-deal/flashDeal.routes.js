import express from "express";
import {
  checkFlashDeal,
  attachListing,
  myActiveFlashDeals,
  purchaseFlashDeal,
} from "./flashDealController.js";
import {
  createFlashDeal,
  listFlashDeals,
  updateFlashDeal,
  deleteFlashDeal,
} from "./flashDealAdminController.js";
import { authenticate } from "../../middleware/userAuth.js";

const router = express.Router();

// ── USER ROUTES ──
router.get("/check", authenticate, checkFlashDeal);
router.post("/attach-listing", authenticate, attachListing);
router.get("/my-active", authenticate, myActiveFlashDeals);
router.post("/purchase", authenticate, purchaseFlashDeal);

// ── ADMIN ROUTES ──
router.get("/admin/list", authenticate, listFlashDeals);
router.post("/admin", authenticate, createFlashDeal);
router.put("/admin/:id", authenticate, updateFlashDeal);
router.delete("/admin/:id", authenticate, deleteFlashDeal);

export default router;
