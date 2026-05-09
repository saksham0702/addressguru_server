import BusinessListing from "../../model/businessListingSchema.js";
import { parseSearchQuery, categoryKeywordsMap } from "./search.utils.js";

/**
 * GET /api/search/suggestions?q=...
 *
 * Returns a single flat sorted array of suggestions — best match first.
 * Each item has a `type` and `score`. Frontend just renders them in order.
 *
 * Scoring tiers:
 *   120 = exact match
 *   100 = starts with query
 *    80 = query is a substring of the candidate
 *    60 = all query words present in candidate (any order)
 *    30 = more than half of words match  ← minimum for category/business
 *     0 = discard (services/courses are discarded below 60)
 *
 * category_city gets +50 bonus on top of its base score (always high priority
 * when both are present).
 *
 * Response:
 * {
 *   suggestions: [
 *     // category + city redirect
 *     { type:"category_city", label, redirectUrl, category:{name,slug}, city:{name,slug}, score }
 *     // category only redirect
 *     { type:"category",      label, redirectUrl, category:{name,slug}, city:null, score }
 *     // business name match
 *     { type:"business",      label, redirectUrl, slug, city, citySlug, category, categorySlug, score }
 *     // service perfect match
 *     { type:"service",       label, sublabel, redirectUrl, businessSlug, city, score }
 *     // course perfect match
 *     { type:"course",        label, sublabel, redirectUrl, businessSlug, city, score }
 *   ]
 * }
 */
export const searchSuggestionsService = async (query) => {
  if (!query || query.trim().length < 2) return { suggestions: [] };

  const { detectedCity, detectedCategory, categoryKeywords, normalizedQuery } =
    await parseSearchQuery(query);

  const q = normalizedQuery.trim();
  const escape = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return { suggestions: [] };

  const [categoryItems, businessItems, serviceItems, courseItems] =
    await Promise.all([
      getCategoryItems({
        detectedCategory,
        detectedCity,
        categoryKeywords,
        q,
        words,
        escape,
      }),
      getBusinessItems({ q, words, detectedCity, escape }),
      getServiceItems({ q, words, detectedCity, escape }),
      getCourseItems({ q, words, detectedCity, escape }),
    ]);

  const all = [
    ...categoryItems,
    ...businessItems,
    ...serviceItems,
    ...courseItems,
  ];
  all.sort((a, b) => b.score - a.score);

  return { suggestions: all.slice(0, 10) };
};

// ─────────────────────────────────────────────────────────────────────────────
// Score a candidate string against the search query
// Returns 0 if the match is too weak to show in suggestions
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Category (+ optional city) suggestions
// ─────────────────────────────────────────────────────────────────────────────
const getCategoryItems = async ({
  detectedCategory,
  detectedCity,
  categoryKeywords,
  q,
  words,
  escape,
}) => {
  if (!detectedCategory || !categoryKeywords?.length) return [];

  const CategoryModel = (await import("../../model/categorySchema.js")).default;
  const CityModel = (await import("../../model/CitiesSchema.js")).default;

  const catRegex = new RegExp(
    `\\b(${categoryKeywords.map(escape).join("|")})\\b`,
    "i",
  );

  const categoryDoc = await CategoryModel.findOne({
    name: { $regex: catRegex },
    isDeleted: { $ne: true },
  })
    .select("name slug")
    .lean();

  if (!categoryDoc) return [];

  // Category always gets at least score 40 so it always shows
  const baseScore = Math.max(scoreMatch(categoryDoc.name, q, words), 40);

  if (!detectedCity) {
    return [
      {
        type: "category",
        label: categoryDoc.name,
        redirectUrl: `/${categoryDoc.slug}`,
        category: { name: categoryDoc.name, slug: categoryDoc.slug },
        city: null,
        score: baseScore,
      },
    ];
  }

  const cityDoc = await CityModel.findOne({
    name: { $regex: new RegExp(`^${escape(detectedCity)}$`, "i") },
  })
    .select("name slug")
    .lean();

  if (!cityDoc) {
    return [
      {
        type: "category",
        label: categoryDoc.name,
        redirectUrl: `/${categoryDoc.slug}`,
        category: { name: categoryDoc.name, slug: categoryDoc.slug },
        city: null,
        score: baseScore,
      },
    ];
  }

  // Category + city → +50 bonus, always floats high
  return [
    {
      type: "category_city",
      label: `${categoryDoc.name} in ${cityDoc.name}`,
      redirectUrl: `/${categoryDoc.slug}/${cityDoc.slug}`,
      category: { name: categoryDoc.name, slug: categoryDoc.slug },
      city: { name: cityDoc.name, slug: cityDoc.slug },
      score: baseScore + 50,
    },
  ];
};

// ─────────────────────────────────────────────────────────────────────────────
// Business name suggestions (min score 30 to appear)
// ─────────────────────────────────────────────────────────────────────────────
const getBusinessItems = async ({ q, words, detectedCity, escape }) => {
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
      redirectUrl: `/${biz.slug}`,
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

// ─────────────────────────────────────────────────────────────────────────────
// Service suggestions — only show if score >= 60 (perfect/near-perfect match)
// ─────────────────────────────────────────────────────────────────────────────
const getServiceItems = async ({ q, words, detectedCity, escape }) => {
  const serviceRegex = new RegExp(words.map(escape).join("|"), "i");

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
        "services.name": { $regex: serviceRegex },
      },
    },
    { $unwind: "$services" },
    { $match: { "services.name": { $regex: serviceRegex } } },
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
      $project: {
        serviceName: "$services.name",
        businessName: "$businessName",
        businessSlug: "$slug",
        city: "$cityDoc.name",
        citySlug: "$cityDoc.slug",
      },
    },
  ]);

  const items = [];
  for (const s of raw) {
    const score = scoreMatch(s.serviceName, q, words);
    if (score < 60) continue; // strict threshold — only good matches
    items.push({
      type: "service",
      label: s.serviceName,
      sublabel: `@ ${s.businessName}${s.city ? ` · ${s.city}` : ""}`,
      redirectUrl: `/listing/${s.businessSlug}`,
      businessSlug: s.businessSlug,
      city: s.city || null,
      score,
    });
  }

  return items.sort((a, b) => b.score - a.score).slice(0, 3);
};

// ─────────────────────────────────────────────────────────────────────────────
// Course suggestions — only show if score >= 60
// ─────────────────────────────────────────────────────────────────────────────
const getCourseItems = async ({ q, words, detectedCity, escape }) => {
  const courseRegex = new RegExp(words.map(escape).join("|"), "i");

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
        "courses.name": { $regex: courseRegex },
      },
    },
    { $unwind: "$courses" },
    { $match: { "courses.name": { $regex: courseRegex } } },
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
      $project: {
        courseName: "$courses.name",
        businessName: "$businessName",
        businessSlug: "$slug",
        city: "$cityDoc.name",
        citySlug: "$cityDoc.slug",
      },
    },
  ]);

  const items = [];
  for (const c of raw) {
    const score = scoreMatch(c.courseName, q, words);
    if (score < 60) continue; // strict threshold
    items.push({
      type: "course",
      label: c.courseName,
      sublabel: `@ ${c.businessName}${c.city ? ` · ${c.city}` : ""}`,
      redirectUrl: `/listing/${c.businessSlug}`,
      businessSlug: c.businessSlug,
      city: c.city || null,
      score,
    });
  }

  return items.sort((a, b) => b.score - a.score).slice(0, 3);
};
