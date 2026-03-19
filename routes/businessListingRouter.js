// ─── routes/businessListing.routes.js ────────────────────────────────────────
import express from "express";
import {
  createListing,
  updateListingStep,
  getAllListingsWithPaginationAndFilters,
  getListingBySlug,
  deleteListing,
  getFeaturesAndAdditionalFieldsByCategory,
  getListingByUser,
} from "../controller/businessListing.Controller.js";
import { setUploadFolder } from "../middleware/setUploadFolder.js";
import upload from "../middleware/multerConfig.js";
import { validateBusinessStep } from "../middleware/validateBusiness.js";
import { authenticate, optionalAuth } from "../middleware/userAuth.js";
const router = express.Router();

// Create — always step 1
router.post(
  "/create-listing/step/:step",
  // optionalAuth,
  // authenticate,
  setUploadFolder("business-listings"),
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "images", maxCount: 10 },
  ]),
  validateBusinessStep,
  createListing,
);

// Update — uses slug, not id
router.put(
  "/update-listing/:slug/step/:step",
  // authenticate,
  // optionalAuth,
  setUploadFolder("business-listings"),
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "images", maxCount: 10 },
  ]),
  validateBusinessStep,
  updateListingStep,
);


router.get("/", (req, res) => {
  res.send(`
    <h1 style="text-align:center;">
      Welcome to AddressGuru UAE Backend Business Listing Router
    </h1>
  `);
});

router.get("/get-listing-by-user/:id", getListingByUser);
router.get("/get-all-listings", getAllListingsWithPaginationAndFilters);
router.get("/get-listing-by-slug/:slug", getListingBySlug);
router.delete("/delete-listing/:slug", deleteListing);

// Features + additional fields by category (used to build step 1 form)
router.get(
  "/get-features/:category_id",
  getFeaturesAndAdditionalFieldsByCategory,
);

export default router;
