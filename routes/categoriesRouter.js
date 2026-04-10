import express from "express";
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryByType,
} from "../controller/categories.Controller.js";
import { authenticate } from "../middleware/userAuth.js";
import { setUploadFolder } from "../middleware/setUploadFolder.js";
import upload from "../middleware/multerConfig.js";

const router = express.Router();
router.post(
  "/create-category",
  authenticate,
  setUploadFolder("categories"),
  upload.single("ogImage"),
  createCategory,
);

router.put(
  "/update-category/:id",
  authenticate,
  setUploadFolder("categories"),
  upload.single("ogImage"),
  updateCategory, 
);
router.get("/get-categories", getCategories);
router.get("/get-categories-by-type/:type", getCategoryByType);
router.get("/get-category/:id", getCategoryById);
router.delete("/delete-category/:id", deleteCategory);

export default router;
