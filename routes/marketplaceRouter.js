// ─── routes/marketplaceListing.routes.js ─────────────────────────────────────
import express from "express";
import { validateStep } from "../middleware/validateStep.js";
// import { marketplaceStepSchemas } from "../validations/marketplace.validator.js";
import {
  createMarketplaceListing,
  updateMarketplaceListingStep,
  getAllMarketplaceListings,
  getMarketplaceListingBySlug,
  markMarketplaceListingAsSold,
  deleteMarketplaceListing,
} from "../controller/marketplace.Controller.js";
import { setUploadFolder } from "../middleware/setUploadFolder.js";
import upload from "../middleware/multerConfig.js";

const router = express.Router();

router.post(
  "/create-listing",
  setUploadFolder("marketplace-listings"),
//  validateStep(marketplaceStepSchemas),
  createMarketplaceListing,
);

router.put(
  "/update-listing/:slug/step/:step",
  setUploadFolder("marketplace-listings"),
  upload.fields([{ name: "images", maxCount: 15 }]),
  // validateStep(marketplaceStepSchemas),
  updateMarketplaceListingStep,
);

router.get("/get-all-listings", getAllMarketplaceListings);
router.get("/get-listing-by-slug/:slug", getMarketplaceListingBySlug);
router.patch("/mark-as-sold/:slug", markMarketplaceListingAsSold);
router.delete("/delete-listing/:slug", deleteMarketplaceListing);

export default router;
