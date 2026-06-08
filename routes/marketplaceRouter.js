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
  getApprovedListings,
  unpublishListing,
  publishListing,
  getMarketplaceCategoryInfo,
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
router.put(
  "/:id/status",
  authenticate,
  updateMarketplaceListingStatus
);
router.patch("/:identifier/unpublish", authenticate, unpublishListing);
router.patch("/:identifier/publish", authenticate, publishListing);
router.get("/get-approved-listings", getApprovedListings);
router.patch("/mark-as-sold/:id", authenticate, markMarketplaceListingAsSold);
router.delete("/delete-listing/:id", authenticate, deleteMarketplaceListing);

router.get("/category-info/:categoryId", getMarketplaceCategoryInfo);

export default router;
