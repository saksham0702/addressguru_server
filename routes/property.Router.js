// ─── routes/propertyListing.routes.js ────────────────────────────────────────
import express from "express";
import {
  createPropertyListing,
  updatePropertyListingStep,
  getAllPropertyListings,
  getPropertyListingBySlug,
  markPropertyListingAsSold,
  deletePropertyListing,
} from "../controller/property.Controller.js";
import { setUploadFolder } from "../middleware/setUploadFolder.js";
import upload from "../middleware/multerConfig.js";
import { validatePropertyStep } from "../middleware/validateProperty.js";

const router = express.Router();

// Create is always step 1 — param fixed to /step/1 implicitly via middleware
router.post(
  "/create-listing/step/:step",
  setUploadFolder("property-listings"),
  upload.fields([{ name: "images", maxCount: 20 }]),
  validatePropertyStep,
  createPropertyListing,
);

// Update — uses slug, not id
router.put(
  "/update-listing/:slug/step/:step",
  setUploadFolder("property-listings"),
  upload.fields([{ name: "images", maxCount: 20 }]),
  validatePropertyStep,
  updatePropertyListingStep,
);

router.get("/get-all-listings", getAllPropertyListings);
router.get("/get-listing-by-slug/:slug", getPropertyListingBySlug);
router.patch("/mark-as-sold/:slug", markPropertyListingAsSold);
router.delete("/delete-listing/:slug", deletePropertyListing);

export default router;