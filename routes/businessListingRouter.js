import express from "express";
import { validateStep } from "../middleware/validateStep.js";
import { businessStepSchemas } from "../validations/business.validator.js";
import {
  getFeaturesAndAdditionalFieldsByCategory,
  createListing,
  updateListingStep,
} from "../controller/businessListing.Controller.js";
import { setUploadFolder } from "../middleware/setUploadFolder.js";
import upload from "../middleware/multerConfig.js";

const router = express.Router();

router.post(
  "/create-listing",  
  setUploadFolder("business-listings"),
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "images", maxCount: 10 },
  ]),
  validateStep(businessStepSchemas),
  createListing,
);

router.put(
  "/update-listing/:id/step/:step",
  validateStep(businessStepSchemas),
  updateListingStep,
);
router.get(
  "/get-features-and-additional-fields/:category_id",
  getFeaturesAndAdditionalFieldsByCategory,
);

export default router;
