// ─── routes/propertyListing.routes.js ────────────────────────────────────────
import express from "express";
import {
  createPropertyListing,
  updatePropertyListingStep,
  getAllPropertyListings,
  getPropertyListingBySlug,
  deletePropertyListing,
} from "../controller/property.Controller.js";
import { setUploadFolder } from "../middleware/setUploadFolder.js";
import upload from "../middleware/multerConfig.js";

const router = express.Router();

router.post(
  "/create-listing",
  setUploadFolder("property-listings"),
  createPropertyListing,
);

router.put(
  "/update-listing/:id/step/:step",
  setUploadFolder("property-listings"),
  upload.fields([{ name: "images", maxCount: 20 }]),
  updatePropertyListingStep,
);

router.get("/get-all-listings", getAllPropertyListings);
router.get("/get-listing-by-slug/:slug", getPropertyListingBySlug);
router.delete("/delete-listing/:id", deletePropertyListing);

export default router;
