import express from "express";
import { aiBusinessSearch } from "./aiSearch.controller.js";
import { aiSearchLimiter, validateSearchQuery } from "./aiSearch.middleware.js";

const router = express.Router();
router.post(
  "/business-search",
  aiSearchLimiter,
  validateSearchQuery,
  aiBusinessSearch,
);

export default router;
