import BusinessListing from "../../model/businessListingSchema.js";
import { parseSearchQuery } from "./search.utils.js";

export const searchListingsService = async (query, page = 1, limit = 20) => {
  if (!query) return { results: [], total: 0, page: 1, totalPages: 0 };

  const {
    topicKeywords,
    detectedCity,
    detectedCategory,
    categoryKeywords,
    normalizedQuery,
  } = await parseSearchQuery(query);

  // Nothing useful parsed → bail
  if (!detectedCity && !detectedCategory && !topicKeywords.length) {
    return { results: [], total: 0, page: 1, totalPages: 0 };
  }

  const skip = (page - 1) * limit;
  const escape = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // ─── Build regexes ────────────────────────────────────────────────────────

  // Category regex: matches ANY keyword belonging to the detected category
  const escapedCategoryKws = categoryKeywords.map(escape);
  const categoryRegex =
    detectedCategory && escapedCategoryKws.length
      ? new RegExp(`\\b(${escapedCategoryKws.join("|")})\\b`, "i")
      : null;

  // Topic regex: used only when no category detected (free-text mode)
  const escapedTopics = topicKeywords.map(escape);
  const topicRegex =
    !detectedCategory && topicKeywords.length
      ? new RegExp(`\\b(${escapedTopics.join("|")})\\b`, "i")
      : null;

  // City regex: exact match against city name
  const cityRegex = detectedCity
    ? new RegExp(`^${escape(detectedCity)}$`, "i")
    : null;

  // ─── Stage 1: Hard content filter ────────────────────────────────────────
  // CATEGORY MODE  → searchText must match a category keyword (strict)
  // KEYWORD MODE   → searchText must match a topic keyword
  const stage1ContentFilter = detectedCategory
    ? { searchText: { $regex: categoryRegex } }
    : { searchText: { $regex: topicRegex } };

  const pipeline = [
    // ── Stage 1: Base hard filter ─────────────────────────────────────────
    {
      $match: {
        isDeleted: false,
        isPublished: true,
        status: "approved",
        ...stage1ContentFilter,
      },
    },

    // ── Stage 2: Lowercase fields for later scoring ───────────────────────
    {
      $addFields: {
        businessNameLower: { $toLower: "$businessName" },
        searchTextLower: { $toLower: { $ifNull: ["$searchText", ""] } },
      },
    },

    // ── Stage 3: Lookup + join category ──────────────────────────────────
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
      $addFields: {
        categoryNameLower: { $toLower: { $ifNull: ["$categoryDoc.name", ""] } },
      },
    },

    // ── Stage 4: Lookup + join city ───────────────────────────────────────
    {
      $lookup: {
        from: "cities",
        localField: "city",
        foreignField: "_id",
        as: "cityDoc",
      },
    },
    { $unwind: { path: "$cityDoc", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        resolvedCityNameLower: { $toLower: { $ifNull: ["$cityDoc.name", ""] } },
      },
    },

    // ── Stage 5: STRICT CITY FILTER ───────────────────────────────────────
    // If user mentioned a city → ONLY listings in that city pass. No exceptions.
    ...(detectedCity
      ? [{ $match: { resolvedCityNameLower: { $regex: cityRegex } } }]
      : []),

    // ── Stage 6: STRICT CATEGORY FILTER ──────────────────────────────────
    // If category detected → listing's category name OR searchText must
    // match a category keyword. This is a hard gate, not a boost.
    ...(detectedCategory && categoryRegex
      ? [
          {
            $match: {
              $or: [
                { categoryNameLower: { $regex: categoryRegex } },
                { searchTextLower: { $regex: categoryRegex } },
              ],
            },
          },
        ]
      : []),

    // ── Stage 7: Scoring ──────────────────────────────────────────────────
    // Priority order: category match > business name match > description match
    {
      $addFields: {
        score: {
          $add: [
            // ── CATEGORY SIGNALS (highest priority) ───────────────────────

            // Category name exactly equals the detected category key (+600)
            ...(detectedCategory
              ? [
                  {
                    $cond: [
                      {
                        $regexMatch: {
                          input: "$categoryNameLower",
                          regex: categoryRegex,
                        },
                      },
                      600,
                      0,
                    ],
                  },
                ]
              : []),

            // Category name exactly matches normalized full query (+100 bonus)
            {
              $cond: [{ $eq: ["$categoryNameLower", normalizedQuery] }, 100, 0],
            },

            // ── BUSINESS NAME SIGNALS ─────────────────────────────────────

            // Business name contains a category keyword (+300)
            ...(categoryRegex
              ? [
                  {
                    $cond: [
                      {
                        $regexMatch: {
                          input: "$businessNameLower",
                          regex: categoryRegex,
                        },
                      },
                      300,
                      0,
                    ],
                  },
                ]
              : []),

            // Business name contains a topic keyword — keyword mode only (+300)
            ...(topicRegex
              ? [
                  {
                    $cond: [
                      {
                        $regexMatch: {
                          input: "$businessNameLower",
                          regex: topicRegex,
                        },
                      },
                      300,
                      0,
                    ],
                  },
                ]
              : []),

            // Business name starts with first keyword (+50)
            ...(topicRegex && escapedTopics.length
              ? [
                  {
                    $cond: [
                      {
                        $regexMatch: {
                          input: "$businessNameLower",
                          regex: `^${escapedTopics[0]}`,
                        },
                      },
                      50,
                      0,
                    ],
                  },
                ]
              : []),

            // Business name starts with first category keyword (+50)
            ...(categoryRegex && escapedCategoryKws.length
              ? [
                  {
                    $cond: [
                      {
                        $regexMatch: {
                          input: "$businessNameLower",
                          regex: `^${escapedCategoryKws[0]}`,
                        },
                      },
                      50,
                      0,
                    ],
                  },
                ]
              : []),

            // ── DESCRIPTION / SEARCHTEXT SIGNALS ─────────────────────────

            // Per category-keyword hit in searchText (+20 each, up to 5 keywords)
            ...(detectedCategory && categoryKeywords.length
              ? [
                  {
                    $multiply: [
                      {
                        $min: [
                          {
                            $size: {
                              $filter: {
                                input: categoryKeywords.slice(0, 10), // cap iterations
                                as: "kw",
                                cond: {
                                  $regexMatch: {
                                    input: "$searchTextLower",
                                    regex: "$$kw",
                                  },
                                },
                              },
                            },
                          },
                          5, // cap bonus at 5 matched keywords
                        ],
                      },
                      20,
                    ],
                  },
                ]
              : []),

            // Per topic-keyword hit in searchText — keyword mode (+20 each)
            ...(!detectedCategory && topicKeywords.length
              ? [
                  {
                    $multiply: [
                      {
                        $size: {
                          $filter: {
                            input: topicKeywords,
                            as: "kw",
                            cond: {
                              $regexMatch: {
                                input: "$searchTextLower",
                                regex: "$$kw",
                              },
                            },
                          },
                        },
                      },
                      20,
                    ],
                  },
                ]
              : []),
          ],
        },
      },
    },

    // ── Stage 8: Drop zero-score results ──────────────────────────────────
    { $match: { score: { $gt: 0 } } },

    // ── Stage 9: Sort by score desc, then newest first ────────────────────
    { $sort: { score: -1, createdAt: -1 } },

    // ── Stage 10: Paginate with $facet ────────────────────────────────────
    {
      $facet: {
        metadata: [{ $count: "total" }],
        results: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              businessName: 1,
              slug: 1,
              description: 1,
              logo: 1,
              businessAddress: 1,
              score: 1,
              category: {
                name: "$categoryDoc.name",
                slug: "$categoryDoc.slug",
              },
              city: {
                name: "$cityDoc.name",
                slug: "$cityDoc.slug",
              },
            },
          },
        ],
      },
    },
  ];

  const [data] = await BusinessListing.aggregate(pipeline);

  const results = data?.results || [];
  const total = data?.metadata?.[0]?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    results,
    total,
    page: parseInt(page),
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};
