import BusinessListing from "../../model/businessListingSchema.js";
import { parseSearchQuery } from "./search.utils.js";

export const searchListingsService = async (query, page = 1, limit = 20) => {
  if (!query) return { results: [], total: 0, page: 1, totalPages: 0 };

  const { topicKeywords, detectedCity, normalizedQuery } = await parseSearchQuery(
    query,
  );

  if (!topicKeywords.length)
    return { results: [], total: 0, page: 1, totalPages: 0 };

  const skip = (page - 1) * limit;

  const escape = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedTopics = topicKeywords.map(escape);

  // Matches any topic keyword as a whole word in content
  const topicRegex = new RegExp(`\\b(${escapedTopics.join("|")})\\b`, "i");

  const pipeline = [
    // ─── Stage 1: Gate on topic match (NOT city) ─────────────────────────
    {
      $match: {
        isDeleted: false,
        isPublished: true,
        status: "approved",
        // City is excluded from searchText now — this only matches real content
        searchText: { $regex: topicRegex },
      },
    },

    // ─── Stage 2: Lowercase fields for scoring ────────────────────────────
    {
      $addFields: {
        businessNameLower: { $toLower: "$businessName" },
        descriptionLower: { $toLower: { $ifNull: ["$description", ""] } },
        searchTextLower: { $toLower: { $ifNull: ["$searchText", ""] } },
      },
    },

    // ─── Stage 3: Count how many topic keywords matched ───────────────────
    {
      $addFields: {
        topicMatchCount: {
          $size: {
            $filter: {
              input: topicKeywords,
              as: "kw",
              cond: {
                $regexMatch: { input: "$searchTextLower", regex: "$$kw" },
              },
            },
          },
        },
      },
    },

    // ─── Stage 4: Lookup category ─────────────────────────────────────────
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
        categoryNameLower: {
          $toLower: { $ifNull: ["$categoryDoc.name", ""] },
        },
      },
    },

    // ─── Stage 5: Require meaningful topic match ──────────────────────────
    // Must match in name, category, or have 2+ topic keyword hits in searchText
    {
      $match: {
        $or: [
          { businessNameLower: { $regex: topicRegex } },
          { categoryNameLower: { $regex: topicRegex } },
          {
            topicMatchCount: {
              $gte: topicKeywords.length > 1 ? 2 : 1,
            },
          },
        ],
      },
    },

    // ─── Stage 6: Score ───────────────────────────────────────────────────
    {
      $addFields: {
        score: {
          $add: [
            // Category exact match = strongest signal (+500)
            {
              $cond: [{ $eq: ["$categoryNameLower", normalizedQuery] }, 500, 0],
            },

            // Business name contains topic keyword (+300)
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

            // Category name contains topic keyword (+150)
            {
              $cond: [
                {
                  $regexMatch: {
                    input: "$categoryNameLower",
                    regex: topicRegex,
                  },
                },
                150,
                0,
              ],
            },

            // Per-keyword match in business name (+25 each)
            {
              $multiply: [
                {
                  $size: {
                    $filter: {
                      input: topicKeywords,
                      as: "kw",
                      cond: {
                        $regexMatch: {
                          input: "$businessNameLower",
                          regex: "$$kw",
                        },
                      },
                    },
                  },
                },
                25,
              ],
            },

            // Business name starts with first keyword (+50)
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

            // ─── City boost (BONUS, not a gate) ──────────────────────────
            // If user mentioned a city and this listing is in that city: +200
            ...(detectedCity
              ? [
                  {
                    $cond: [
                      {
                        $regexMatch: {
                          input: {
                            $ifNull: ["$cityNameLower", ""],
                          },
                          regex: new RegExp(escape(detectedCity), "i"),
                        },
                      },
                      200,
                      0,
                    ],
                  },
                ]
              : []),

            // Topic matched only in description/searchText, not name/category (-50)
            {
              $cond: [
                {
                  $and: [
                    { $gt: ["$topicMatchCount", 0] },
                    {
                      $eq: [
                        {
                          $size: {
                            $filter: {
                              input: topicKeywords,
                              as: "kw",
                              cond: {
                                $regexMatch: {
                                  input: "$businessNameLower",
                                  regex: "$$kw",
                                },
                              },
                            },
                          },
                        },
                        0,
                      ],
                    },
                    {
                      $eq: [
                        {
                          $size: {
                            $filter: {
                              input: topicKeywords,
                              as: "kw",
                              cond: {
                                $regexMatch: {
                                  input: "$categoryNameLower",
                                  regex: "$$kw",
                                },
                              },
                            },
                          },
                        },
                        0,
                      ],
                    },
                  ],
                },
                -50,
                0,
              ],
            },
          ],
        },
      },
    },

    // ─── Stage 7: Filter low-confidence results ───────────────────────────
    // Raised from 40 → 100 so city-only matches can never pass
    { $match: { score: { $gte: 100 } } },

    // ─── Stage 8: Sort ────────────────────────────────────────────────────
    { $sort: { score: -1, createdAt: -1 } },

    // ─── Stage 9: Paginate ────────────────────────────────────────────────
    {
      $facet: {
        metadata: [{ $count: "total" }],
        results: [
          { $skip: skip },
          { $limit: limit },
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

  const results = data.results || [];
  const total = data.metadata[0]?.total || 0;
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
