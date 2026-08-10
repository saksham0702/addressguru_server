// routes/sitemapRoutes.js
import express from "express";
import {
  getRootSitemap,
  getSectionMeta,
  getShardedListings,
  getListingCategoryCityMeta,
  getListingCategoryCityShard,
} from "../controller/sitemap.Controller.js";

const router = express.Router();

router.get("/root", getRootSitemap);
router.get("/section/:section/meta", getSectionMeta);
router.get("/section/:section/shard", getShardedListings); // ?page=1
router.get("/listing/categories/meta", getListingCategoryCityMeta);
router.get("/listing/categories/shard", getListingCategoryCityShard); // ?page=1

export default router;
