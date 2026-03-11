import express from "express";
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controller/categories.Controller.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

const router = express.Router();
router.post("/create-category", verifyAdmin, createCategory);
router.get("/get-categories", verifyAdmin, getCategories);
router.get("/get-category/:id", getCategoryById);
router.put("/update-category/:id", updateCategory);
router.delete("/delete-category/:id", deleteCategory);

export default router;

