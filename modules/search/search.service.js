import BusinessListing from "../../model/businessListingSchema.js";
import City from "../../model/CitiesSchema.js";
import { parseSearchQuery } from "./search.utils.js";

/**
 * Simplified search service for listing view.
 * Prioritizes:
 * 1. Business Name match
 * 2. Category / Tag match
 */
export const searchListingsService = async (query, page = 1, limit = 20) => {
  if (!query) return { results: [], total: 0, page: 1, totalPages: 0 };

  const {
    detectedCity,
    detectedCategory,
    detectedCategorySlug,
    normalizedQuery,
  } = await parseSearchQuery(query);

  const skip = (page - 1) * limit;
  const escape = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const words = normalizedQuery.split(/\s+/).filter((w) => w.length > 1);
  const nameRegex = words.length > 0 ? new RegExp(words.map(escape).join(".*"), "i") : null;

  // Build the match stage
  const match = {
    isDeleted: false,
    isPublished: true,
    status: "approved",
  };

  const orConditions = [];

  // 1. Business Name match
  if (nameRegex) {
    orConditions.push({ businessName: { $regex: nameRegex } });
  }

  // 2. Category match
  if (detectedCategory) {
    // This will match if the searchText (which we cleaned up) contains the category/tags
    // or we can use the category lookup. Let's use the searchText for simplicity as it's indexed.
    orConditions.push({ searchText: { $regex: new RegExp(escape(detectedCategory), "i") } });
  }

  if (orConditions.length > 0) {
    match.$or = orConditions;
  } else {
    // If no words and no category, return empty
    return { results: [], total: 0, page: 1, totalPages: 0 };
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "cities",
        localField: "city",
        foreignField: "_id",
        as: "cityDoc",
      },
    },
    { $unwind: { path: "$cityDoc", preserveNullAndEmptyArrays: true } },
    // Strict city filter if detected
    ...(detectedCity
      ? [
          {
            $match: {
              "cityDoc.name": { $regex: new RegExp(`^${escape(detectedCity)}$`, "i") },
            },
          },
        ]
      : []),
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
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              businessName: 1,
              slug: 1,
              description: 1,
              logo: 1,
              businessAddress: 1,
              city: {
                name: "$cityDoc.name",
                slug: "$cityDoc.slug",
              },
              category: {
                name: "$categoryDoc.name",
                slug: "$categoryDoc.slug",
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
