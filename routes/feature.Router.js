// routes/featureRoutes.js
import express from "express";
import {
  createFeature,
  getAllFeatures,
  getFeatureById,
  updateFeature,
  deleteFeature,
  assignFeaturesToCategory,
  removeFeatureFromCategory,
  getCategoryFeatures,
  assignFeaturesToSubCategory,
  removeFeatureFromSubCategory,
  getSubCategoryFeatures,
} from "../controller/featureController.js";

const router = express.Router();

// ─── FEATURE ROUTES ───────────────────────────────────────────────────────────
router.post("/create-feature", createFeature);
router.get("/get-all-features", getAllFeatures); // ?type=facility&isActive=true
router.get("/get-feature-by-id/:id", getFeatureById);
router.put("/update-feature/:id", updateFeature);
router.delete("/delete-feature/:id", deleteFeature);

// ─── CATEGORY-FEATURE ASSIGNMENT ROUTES ──────────────────────────────────────
router.post("/category/:categoryId/assign", assignFeaturesToCategory);
router.delete(
  "/category/:categoryId/remove/:featureId",
  removeFeatureFromCategory,
);
router.get("/category/:categoryId", getCategoryFeatures);

router.post("/category/:categoryId/subcategory/:subcategoryId/assign", assignFeaturesToSubCategory);
router.delete("/category/:categoryId/subcategory/:subcategoryId/remove/:featureId", removeFeatureFromSubCategory);
router.get("/category/:categoryId/subcategory/:subcategoryId", getSubCategoryFeatures);

export default router;
