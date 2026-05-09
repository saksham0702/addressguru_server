import express from "express";
import { searchSuggestionsService } from "./search.sugesstions.service.js";
import { searchResolveService } from "./search.resolve.service.js";

const router = express.Router();

/**
 * GET /api/search/suggestions?q=gym in delhi
 *
 * Live suggestions while user is typing.
 * Debounce this on frontend (300ms recommended).
 *
 * Response:
 * {
 *   categoryCity: { category, categorySlug, city, citySlug, redirectUrl } | null,
 *   businesses:   [{ name, slug, city, citySlug, category }],
 *   services:     [{ serviceName, businessName, businessSlug, city }],
 *   courses:      [{ courseName,  businessName, businessSlug, city }],
 * }
 */
router.get("/suggestions", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({
        categoryCity: null,
        businesses: [],
        services: [],
        courses: [],
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
 * GET /api/search/resolve?q=gym in delhi&page=1&limit=20
 *
 * Called when user submits the search.
 * Frontend reads `intent` to decide what to do next:
 *
 *  "category_city"  → navigate to redirectUrl  (/{categorySlug}/{citySlug})
 *  "category"       → navigate to redirectUrl  (/{categorySlug})
 *  "exact_business" → navigate to redirectUrl  (/listing/{slug})
 *  "business_list"  → render listings grid (multiple name matches)
 *  "service_match"  → render listings grid (matched by service name)
 *  "course_match"   → render listings grid (matched by course name)
 *  "keyword_search" → render listings grid (generic keyword fallback)
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
