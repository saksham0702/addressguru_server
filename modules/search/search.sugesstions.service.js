import BusinessListing from "../../model/businessListingSchema.js";
import City from "../../model/CitiesSchema.js";
import { parseSearchQuery, getCategoryIndex } from "./search.utils.js";

/**
 * GET /api/search/suggestions?q=...
 *
 * Returns a single flat sorted array of suggestions — best match first.
 */
export const searchSuggestionsService = async (query) => {
  if (!query || query.trim().length < 2) return { suggestions: [] };

  const { detectedCity, detectedCategory, detectedCategorySlug, normalizedQuery } =
    await parseSearchQuery(query);

  const q = normalizedQuery.trim();
  const escape = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return { suggestions: [] };

  const [categoryItems, businessItems] = await Promise.all([
    getCategorySuggestions({
      detectedCategory,
      detectedCategorySlug,
      detectedCity,
      q,
      words,
      escape,
    }),
    getBusinessSuggestions({ q, words, detectedCity, escape }),
  ]);

  const all = [...categoryItems, ...businessItems];
  all.sort((a, b) => b.score - a.score);

  return { suggestions: all.slice(0, 10) };
};

// ── Score a candidate string against the search query ───────────────────────
const scoreMatch = (candidate, q, words) => {
  if (!candidate) return 0;
  const c = candidate.toLowerCase();
  const query = q.toLowerCase();

  if (c === query) return 120;
  if (c.startsWith(query)) return 100;
  if (c.includes(query)) return 80;

  const allWordsPresent = words.every((w) => c.includes(w));
  if (allWordsPresent) return 60;

  const matchCount = words.filter((w) => c.includes(w)).length;
  if (matchCount > 0 && matchCount >= Math.ceil(words.length / 2)) return 30;

  return 0;
};

// ── Category (+ optional city) suggestions ─────────────────────────────────
const getCategorySuggestions = async ({
  detectedCategory,
  detectedCategorySlug,
  detectedCity,
  q,
  words,
  escape,
}) => {
  if (!detectedCategory) return [];

  // Category always gets at least score 40
  const baseScore = Math.max(scoreMatch(detectedCategory, q, words), 40);

  if (!detectedCity) {
    return [
      {
        type: "category",
        label: detectedCategory,
        redirectUrl: `/${detectedCategorySlug}`,
        category: { name: detectedCategory, slug: detectedCategorySlug },
        city: null,
        score: baseScore,
      },
    ];
  }

  const cityDoc = await City.findOne({
    name: { $regex: new RegExp(`^${escape(detectedCity)}$`, "i") },
  })
    .select("name slug")
    .lean();

  if (!cityDoc) {
    return [
      {
        type: "category",
        label: detectedCategory,
        redirectUrl: `/${detectedCategorySlug}`,
        category: { name: detectedCategory, slug: detectedCategorySlug },
        city: null,
        score: baseScore,
      },
    ];
  }

  return [
    {
      type: "category_city",
      label: `${detectedCategory} in ${cityDoc.name}`,
      redirectUrl: `/${detectedCategorySlug}/${cityDoc.slug}`,
      category: { name: detectedCategory, slug: detectedCategorySlug },
      city: { name: cityDoc.name, slug: cityDoc.slug },
      score: baseScore + 50,
    },
  ];
};

// ── Business name suggestions ───────────────────────────────────────────────
const getBusinessSuggestions = async ({ q, words, detectedCity, escape }) => {
  const nameRegex = new RegExp(words.map(escape).join("|"), "i");

  const cityMatchStage = detectedCity
    ? [
        {
          $match: {
            "cityDoc.name": {
              $regex: new RegExp(`^${escape(detectedCity)}$`, "i"),
            },
          },
        },
      ]
    : [];

  const raw = await BusinessListing.aggregate([
    {
      $match: {
        isDeleted: false,
        isPublished: true,
        status: "approved",
        businessName: { $regex: nameRegex },
      },
    },
    { $limit: 20 },
    {
      $lookup: {
        from: "cities",
        localField: "city",
        foreignField: "_id",
        as: "cityDoc",
      },
    },
    { $unwind: { path: "$cityDoc", preserveNullAndEmptyArrays: true } },
    ...cityMatchStage,
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "categoryDoc",
      },
    },
    { $unwind: { path: "$categoryDoc", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        businessName: 1,
        slug: 1,
        city: "$cityDoc.name",
        citySlug: "$cityDoc.slug",
        category: "$categoryDoc.name",
        categorySlug: "$categoryDoc.slug",
      },
    },
  ]);

  const items = [];
  for (const biz of raw) {
    const score = scoreMatch(biz.businessName, q, words);
    if (score === 0) continue;
    items.push({
      type: "business",
      label: biz.businessName,
      redirectUrl: `/listing/${biz.slug}`,
      slug: biz.slug,
      city: biz.city || null,
      citySlug: biz.citySlug || null,
      category: biz.category || null,
      categorySlug: biz.categorySlug || null,
      score,
    });
  }

  return items.sort((a, b) => b.score - a.score).slice(0, 5);
};
