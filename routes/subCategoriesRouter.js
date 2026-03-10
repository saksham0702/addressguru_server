import express from "express";
import {
  createSubCategory,
  createSubCategoryBySlug,
  getSubCategories,
  getSubCategoriesByCategory,
  getSubCategoriesByCategorySlug,
  updateSubCategory,
  deleteSubCategory,
  getSingleSubCategory,
} from "../controller/subCategories.Controller.js";

const router = express.Router();

// ✅ CREATE
router.post("/create-subcategory", createSubCategory); // ID-based
router.post("/create-subcategories/:categorySlug", createSubCategoryBySlug); // Slug-based

// ✅ READ
router.get("/get-subcategories", getSubCategories); // Get all
router.get("/category/:categoryId", getSubCategoriesByCategory); // By category ID
router.get(
  "/get-subcategorybyslug/:categorySlug",
  getSubCategoriesByCategorySlug,
); // By category slug
router.get("/get-subcategory/:id", getSingleSubCategory); // By ID

// ✅ UPDATE / DELETE (ID ONLY)
router.patch("/update-subcategory/:id", updateSubCategory);
router.delete("/delete-subcategory/:id", deleteSubCategory); // Soft delete

export default router;
