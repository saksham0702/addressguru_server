// ─── routes/marketplaceListing.routes.js ─────────────────────────────────────
import express from "express";
import { validateStep } from "../middleware/validateStep.js";
import { marketplaceStepSchemas } from "../validations/marketplace.validator.js";
import {
  createMarketplaceListing,
  updateMarketplaceListingStep,
  getAllMarketplaceListings,
  getMarketplaceListingBySlug,
  markMarketplaceListingAsSold,
  deleteMarketplaceListing,
} from "../controller/marketplaceListing.Controller.js";
import { setUploadFolder } from "../middleware/setUploadFolder.js";
import upload from "../middleware/multerConfig.js";

const router = express.Router();

router.post(
  "/create-listing",
  setUploadFolder("marketplace-listings"),
  upload.fields([{ name: "images", maxCount: 15 }]),
  validateStep(marketplaceStepSchemas),
  createMarketplaceListing,
);

router.put(
  "/update-listing/:id/step/:step",
  setUploadFolder("marketplace-listings"),
  upload.fields([{ name: "images", maxCount: 15 }]),
  validateStep(marketplaceStepSchemas),
  updateMarketplaceListingStep,
);

router.get("/", getAllMarketplaceListings);
router.get("/:slug", getMarketplaceListingBySlug);
router.patch("/:id/sold", markMarketplaceListingAsSold);
router.delete("/:id", deleteMarketplaceListing);

export default router;
