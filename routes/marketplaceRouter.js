import express from "express";
import {
  createMarketplaceListing,
  updateMarketplaceListingStep,
  getAllMarketplaceListings,
  getMarketplaceListingBySlug,
  markMarketplaceListingAsSold,
  deleteMarketplaceListing,
  getMarketplaceListingByUser,
  updateMarketplaceListingStatus,
  getApprovedListings
} from "../controller/marketplace.Controller.js";
import { setUploadFolder } from "../middleware/setUploadFolder.js";
import upload from "../middleware/multerConfig.js";
import { validateMarketplaceStep } from "../middleware/validateMarketplace.js";
import { authenticate } from "../middleware/userAuth.js";
const router = express.Router();

router.post(
  "/create-listing/step/:step",
  authenticate,
  setUploadFolder("marketplace-listings"),
  upload.fields([{ name: "images", maxCount: 15 }]),
  validateMarketplaceStep,
  createMarketplaceListing,
);

router.put(
  "/update-listing/:slug/step/:step",
  authenticate,
  setUploadFolder("marketplace-listings"),
  upload.fields([{ name: "images", maxCount: 15 }]),
  validateMarketplaceStep,
  updateMarketplaceListingStep,
);

router.get("/get-all-listings", getAllMarketplaceListings);
router.get("/get-marketplace-by-user", authenticate, getMarketplaceListingByUser);
router.get("/get-listing-by-slug/:slug", getMarketplaceListingBySlug);
router.patch("/mark-as-sold/:slug", authenticate, markMarketplaceListingAsSold);
router.delete("/delete-listing/:slug", authenticate, deleteMarketplaceListing);
router.patch(
  "/update-listing-status/:id",
  authenticate,
  updateMarketplaceListingStatus
);
router.get("/get-approved-listings", getApprovedListings);

export default router;
