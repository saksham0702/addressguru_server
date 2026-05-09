import BusinessListing from "../../model/businessListingSchema.js";
import { parseSearchQuery, categoryKeywordsMap } from "./search.utils.js";

/**
 * GET /api/search/resolve?q=...
 *
 * Called when user submits the search (hits enter or clicks a result).
 * Returns a resolved intent so the frontend knows exactly where to navigate.
 *
 * Priority:
 *  1. Category + City detected   → redirect to /{categorySlug}/{citySlug}
 *  2. Category only              → redirect to /{categorySlug}
 *  3. Exact business name match  → redirect to /listing/{slug}
 *  4. Multiple name matches      → return list of matching businesses
 *  5. Service / course match     → return listings that have that service/course
 *  6. Fallback                   → keyword search across searchText
 *
 * Response shape:
 * {
 *   intent: "category_city" | "category" | "exact_business" | "business_list"
 *           | "service_match" | "course_match" | "keyword_search" | "no_results",
 *
 *   // for intent = "category_city" | "category"
 *   redirectUrl: string,
 *   category: { name, slug },
 *   city: { name, slug } | null,
 *
 *   // for intent = "exact_business"
 *   redirectUrl: "/listing/{slug}",
 *   business: { name, slug, city, category },
 *
 *   // for intent = "business_list" | "service_match" | "course_match" | "keyword_search"
 *   listings: [...],
 *   total: number,
 *   page: number,
 *   totalPages: number,
 * }
 */
export const searchResolveService = async (query, page = 1, limit = 20) => {
  if (!query?.trim()) return { intent: "no_results" };

  const {
    topicKeywords,
    detectedCity,
    detectedCategory,
    categoryKeywords,
    normalizedQuery,
  } = await parseSearchQuery(query);

  const escape = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const skip = (page - 1) * limit;

  // ── PRIORITY 1 & 2: Category detected → resolve category doc + optional city ──
  if (detectedCategory) {
    const result = await resolveCategoryIntent({
      detectedCategory,
      detectedCity,
      categoryKeywords,
      escape,
      topicKeywords,
      skip,
      limit,
      page,
    });
    if (result) return result;
  }

  // ── PRIORITY 3 & 4: No category — try matching business name ──────────────
  const nameResults = await resolveBusinessNameIntent({
    normalizedQuery,
    detectedCity,
    escape,
    skip,
    limit,
    page,
  });
  if (nameResults) return nameResults;

  // ── PRIORITY 5a: Service match ────────────────────────────────────────────
  const serviceResults = await resolveServiceIntent({
    normalizedQuery,
    detectedCity,
    escape,
    skip,
    limit,
    page,
  });
  if (serviceResults) return serviceResults;

  // ── PRIORITY 5b: Course match ─────────────────────────────────────────────
  const courseResults = await resolveCourseIntent({
    normalizedQuery,
    detectedCity,
    escape,
    skip,
    limit,
    page,
  });
  if (courseResults) return courseResults;

  // ── PRIORITY 6: Keyword fallback ──────────────────────────────────────────
  if (topicKeywords.length) {
    return resolveKeywordFallback({
      topicKeywords,
      detectedCity,
      escape,
      skip,
      limit,
      page,
    });
  }

  return { intent: "no_results" };
};

// ─────────────────────────────────────────────────────────────────────────────
// Intent resolvers
// ─────────────────────────────────────────────────────────────────────────────

const resolveCategoryIntent = async ({
  detectedCategory,
  detectedCity,
  categoryKeywords,
  escape,
  topicKeywords,
  skip,
  limit,
  page,
}) => {
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

  if (!categoryDoc) return null;

  // City detected → Priority 1: redirect to category+city page
  if (detectedCity) {
    const cityDoc = await CityModel.findOne({
      name: { $regex: new RegExp(`^${escape(detectedCity)}$`, "i") },
    })
      .select("name slug")
      .lean();

    if (cityDoc) {
      return {
        intent: "category_city",
        redirectUrl: `/${categoryDoc.slug}/${cityDoc.slug}`,
        category: { name: categoryDoc.name, slug: categoryDoc.slug },
        city: { name: cityDoc.name, slug: cityDoc.slug },
      };
    }
  }

  // No city → Priority 2: redirect to category page only
  return {
    intent: "category",
    redirectUrl: `/${categoryDoc.slug}`,
    category: { name: categoryDoc.name, slug: categoryDoc.slug },
    city: null,
  };
};

const resolveBusinessNameIntent = async ({
  normalizedQuery,
  detectedCity,
  escape,
  skip,
  limit,
  page,
}) => {
  // Build a regex that requires all words to appear in the name (in any order)
  const words = normalizedQuery.split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return null;

  const nameRegex = new RegExp(words.map(escape).join(".*"), "i");

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

  const pipeline = [
    {
      $match: {
        isDeleted: false,
        isPublished: true,
        status: "approved",
        businessName: { $regex: nameRegex },
      },
    },
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
      $facet: {
        metadata: [{ $count: "total" }],
        results: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              name: "$businessName",
              slug: 1,
              logo: 1,
              businessAddress: 1,
              city: "$cityDoc.name",
              citySlug: "$cityDoc.slug",
              category: "$categoryDoc.name",
              categorySlug: "$categoryDoc.slug",
            },
          },
        ],
      },
    },
  ];

  const [data] = await BusinessListing.aggregate(pipeline);
  const total = data?.metadata?.[0]?.total || 0;
  if (!total) return null;

  const results = data.results || [];
  const totalPages = Math.ceil(total / limit);

  // Exactly 1 result AND it's an exact name match → direct redirect
  if (
    total === 1 &&
    results[0].name.toLowerCase() === normalizedQuery.toLowerCase()
  ) {
    return {
      intent: "exact_business",
      redirectUrl: `/listing/${results[0].slug}`,
      business: results[0],
    };
  }

  // Multiple matches or partial match → return list
  return {
    intent: "business_list",
    listings: results,
    total,
    page: parseInt(page),
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

const resolveServiceIntent = async ({
  normalizedQuery,
  detectedCity,
  escape,
  skip,
  limit,
  page,
}) => {
  // Allow 1-2 character leeway by matching all words with partial regex
  const words = normalizedQuery.split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return null;

  // Each word can have up to 2 extra characters (handles typos / plural etc.)
  const serviceRegex = new RegExp(
    words.map((w) => `${escape(w)}.{0,2}`).join(".*"),
    "i",
  );

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

  const pipeline = [
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
      // Group back by listing so one listing doesn't appear multiple times
      $group: {
        _id: "$_id",
        businessName: { $first: "$businessName" },
        slug: { $first: "$slug" },
        logo: { $first: "$logo" },
        businessAddress: { $first: "$businessAddress" },
        cityName: { $first: "$cityDoc.name" },
        citySlug: { $first: "$cityDoc.slug" },
        categoryName: { $first: "$categoryDoc.name" },
        categorySlug: { $first: "$categoryDoc.slug" },
        matchedServices: { $push: "$services.name" },
      },
    },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        results: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              name: "$businessName",
              slug: 1,
              logo: 1,
              businessAddress: 1,
              city: "$cityName",
              citySlug: 1,
              category: "$categoryName",
              categorySlug: 1,
              matchedServices: 1,
            },
          },
        ],
      },
    },
  ];

  const [data] = await BusinessListing.aggregate(pipeline);
  const total = data?.metadata?.[0]?.total || 0;
  if (!total) return null;

  const totalPages = Math.ceil(total / limit);
  return {
    intent: "service_match",
    listings: data.results || [],
    total,
    page: parseInt(page),
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

const resolveCourseIntent = async ({
  normalizedQuery,
  detectedCity,
  escape,
  skip,
  limit,
  page,
}) => {
  const words = normalizedQuery.split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return null;

  const courseRegex = new RegExp(
    words.map((w) => `${escape(w)}.{0,2}`).join(".*"),
    "i",
  );

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

  const pipeline = [
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
      $group: {
        _id: "$_id",
        businessName: { $first: "$businessName" },
        slug: { $first: "$slug" },
        logo: { $first: "$logo" },
        businessAddress: { $first: "$businessAddress" },
        cityName: { $first: "$cityDoc.name" },
        citySlug: { $first: "$cityDoc.slug" },
        categoryName: { $first: "$categoryDoc.name" },
        categorySlug: { $first: "$categoryDoc.slug" },
        matchedCourses: { $push: "$courses.name" },
      },
    },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        results: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              name: "$businessName",
              slug: 1,
              logo: 1,
              businessAddress: 1,
              city: "$cityName",
              citySlug: 1,
              category: "$categoryName",
              categorySlug: 1,
              matchedCourses: 1,
            },
          },
        ],
      },
    },
  ];

  const [data] = await BusinessListing.aggregate(pipeline);
  const total = data?.metadata?.[0]?.total || 0;
  if (!total) return null;

  const totalPages = Math.ceil(total / limit);
  return {
    intent: "course_match",
    listings: data.results || [],
    total,
    page: parseInt(page),
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

const resolveKeywordFallback = async ({
  topicKeywords,
  detectedCity,
  escape,
  skip,
  limit,
  page,
}) => {
  const escapedTopics = topicKeywords.map(escape);
  const topicRegex = new RegExp(`\\b(${escapedTopics.join("|")})\\b`, "i");

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

  const pipeline = [
    {
      $match: {
        isDeleted: false,
        isPublished: true,
        status: "approved",
        searchText: { $regex: topicRegex },
      },
    },
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
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        results: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              name: "$businessName",
              slug: 1,
              logo: 1,
              businessAddress: 1,
              city: "$cityDoc.name",
              citySlug: "$cityDoc.slug",
              category: "$categoryDoc.name",
              categorySlug: "$categoryDoc.slug",
            },
          },
        ],
      },
    },
  ];

  const [data] = await BusinessListing.aggregate(pipeline);
  const total = data?.metadata?.[0]?.total || 0;
  if (!total) return { intent: "no_results" };

  const totalPages = Math.ceil(total / limit);
  return {
    intent: "keyword_search",
    listings: data.results || [],
    total,
    page: parseInt(page),
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};
