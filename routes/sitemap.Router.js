import express from "express";
import {
  getRootSitemap,
  getSectionSitemap,
  getSectionCategorySitemap,
  getCityListingsSitemap
} from "../controller/sitemap.Controller.js";

const router = express.Router();

router.get("/", getRootSitemap);
router.get("/:section", getSectionSitemap);
router.get("/:section/:type", getSectionCategorySitemap); // type corresponds to category slug
router.get("/:section/:slug/:city", getCityListingsSitemap);

export default router;
