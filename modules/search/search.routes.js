import express from "express";
import { searchSuggestionsService } from "./search.sugesstions.service.js";
import { searchResolveService } from "./search.resolve.service.js";

const router = express.Router();

/**
 * GET /api/search/suggestions?q=...
 *
 * Live suggestions while user is typing.
 * Returns Category/City redirects and Business matches.
 */
router.get("/suggestions", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({
        suggestions: [],
      });
    }
    const data = await searchSuggestionsService(q.trim());
    return res.json(data);
  } catch (err) {
    console.error("[search/suggestions]", err);
    return res.status(500).json({ message: "Search suggestions failed." });
  }
});

/**
 * GET /api/search/resolve?q=...&page=1&limit=20
 *
 * Called when user submits the search.
 * Returns an intent for redirection or listing view.
 *
 * Intents:
 *  "category_city"  → redirect to /{categorySlug}/{citySlug}
 *  "category"       → redirect to /{categorySlug}
 *  "exact_business" → redirect to /listing/{slug}
 *  "business_list"  → render listings grid
 *  "no_results"     → show empty state
 */
router.get("/resolve", async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    if (!q || !q.trim()) {
      return res.json({ intent: "no_results" });
    }
    const data = await searchResolveService(
      q.trim(),
      parseInt(page),
      parseInt(limit),
    );
    return res.json(data);
  } catch (err) {
    console.error("[search/resolve]", err);
    return res.status(500).json({ message: "Search resolve failed." });
  }
});

export default router;
