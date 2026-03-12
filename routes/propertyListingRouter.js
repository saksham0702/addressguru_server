// ─── routes/propertyListing.routes.js ────────────────────────────────────────
import express from "express";
import { validateStep } from "../middleware/validateStep.js";
import { propertyStepSchemas } from "../validations/property.validator.js";
import {
  createPropertyListing,
  updatePropertyListingStep,
  getAllPropertyListings,
  getPropertyListingBySlug,
  deletePropertyListing,
} from "../controller/propertyListing.Controller.js";
import { setUploadFolder } from "../middleware/setUploadFolder.js";
import upload from "../middleware/multerConfig.js";

const router = express.Router();

router.post(
  "/create-listing",
  setUploadFolder("property-listings"),
  upload.fields([
    { name: "images",     maxCount: 20 },
    { name: "floor_plan", maxCount: 1  },
  ]),
  validateStep(propertyStepSchemas),
  createPropertyListing,
);

router.put(
  "/update-listing/:id/step/:step",
  setUploadFolder("property-listings"),
  upload.fields([
    { name: "images",     maxCount: 20 },
    { name: "floor_plan", maxCount: 1  },
  ]),
  validateStep(propertyStepSchemas),
  updatePropertyListingStep,
);

router.get("/",                  getAllPropertyListings);
router.get("/:slug",             getPropertyListingBySlug);
router.delete("/:id",            deletePropertyListing);

export default router;