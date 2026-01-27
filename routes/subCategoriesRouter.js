import express from "express";
import {
  createSubCategory,
  getSubCategories,
  getSubCategoriesByCategory,
  updateSubCategory,
  deleteSubCategory,
} from "../controller/subCategories.Controller.js";

const router = express.Router();

router.post("/", createSubCategory);
router.get("/", getSubCategories);
router.get("/:id", getSubCategoriesByCategory);
router.put("/:id", updateSubCategory);
router.delete("/:id", deleteSubCategory);

export default router;
