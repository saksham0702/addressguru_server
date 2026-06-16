// ─── routes/propertyListing.routes.js ────────────────────────────────────────
import express from "express";
import {
  createPropertyListing,
  updatePropertyListingStep,
  getAllPropertiesWithPaginationAndFilters,
  getPropertyListingBySlug,
  markPropertyListingAsSold,
  deletePropertyListing,
  getPropertyListingByUser,
  updatePropertyListingStatus,
  getApprovedListings,
  unpublishListing,
  publishListing,
  updateLeadStatus,
  upsertAdditionalFields,
  getAdminCompletedListings,
} from "../controller/property.Controller.js";
import { setUploadFolder } from "../middleware/setUploadFolder.js";
import upload from "../middleware/multerConfig.js";
import { validatePropertyStep } from "../middleware/validateProperty.js";
import { authenticate } from "../middleware/userAuth.js";

const router = express.Router();

// Create is always step 1 — param fixed to /step/1 implicitly via middleware
router.post(
  "/create-listing/step/:step",
  authenticate,
  setUploadFolder("property-listings"),
  upload.fields([{ name: "images", maxCount: 20 }]),
  validatePropertyStep,
  createPropertyListing,
);

// Update — uses slug, not id
router.put(
  "/update-listing/:slug/step/:step",
  authenticate,
  setUploadFolder("property-listings"),
  upload.fields([{ name: "images", maxCount: 20 }]),
  validatePropertyStep,
  updatePropertyListingStep,
);

router.get("/get-all-listings", getAllPropertiesWithPaginationAndFilters);
router.get("/get-property-by-user", authenticate, getPropertyListingByUser);
router.get("/get-listing-by-slug/:slug", getPropertyListingBySlug);
router.patch("/mark-as-sold/:slug", authenticate, markPropertyListingAsSold);
router.delete("/delete-listing/:slug", authenticate, deletePropertyListing);
router.put("/:id/status", authenticate, updatePropertyListingStatus);
router.patch("/:identifier/unpublish", authenticate, unpublishListing);
router.patch("/:identifier/publish", authenticate, publishListing);
router.get("/get-approved-listings", getApprovedListings);
router.get("/admin/listings", authenticate, getAdminCompletedListings);
router.put(
  "/:listingId/additional-fields",
  authenticate,
  upsertAdditionalFields,
);
router.patch("/:listingId/lead-status", authenticate, updateLeadStatus);

export default router;
