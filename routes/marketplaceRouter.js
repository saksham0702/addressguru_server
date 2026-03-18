// ─── routes/marketplaceListing.routes.js ─────────────────────────────────────
import express from "express";
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
import { validateMarketplaceStep } from "../middleware/validateMarketplace.js";
const router = express.Router();

router.post(
  "/create-listing/step/:step",
  setUploadFolder("marketplace-listings"),
  upload.fields([{ name: "images", maxCount: 15 }]),
  validateMarketplaceStep,
  createMarketplaceListing,
);

router.put(
  "/update-listing/:slug/step/:step",
  setUploadFolder("marketplace-listings"),
  upload.fields([{ name: "images", maxCount: 15 }]),
  validateMarketplaceStep,
  updateMarketplaceListingStep,
);

router.get("/get-all-listings", getAllMarketplaceListings);
router.get("/get-listing-by-slug/:slug", getMarketplaceListingBySlug);
router.patch("/mark-as-sold/:slug", markMarketplaceListingAsSold);
router.delete("/delete-listing/:slug", deleteMarketplaceListing);

export default router;
