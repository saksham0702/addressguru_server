import express from "express";
import {
  upsertSeoContent,
  getAllSeoContent,
  deleteSeoContent,
  getSeoBySlug,
} from "../controller/seoContent.Controller.js";

const router = express.Router();

/**
 * ============================
 * 🛠️ EDITOR APIs
 * ============================
 */

// Create / Update (Upsert)
router.post("/upsert", upsertSeoContent);

// Get all SEO content (for admin panel)
router.get("/all", getAllSeoContent);

// Delete (soft delete)
router.delete("/delete/:id", deleteSeoContent);


/**
 * ============================
 * 🌐 USER API
 * ============================
 */

// Get SEO by category_slug & city_slug
router.get("/", getSeoBySlug);

export default router;