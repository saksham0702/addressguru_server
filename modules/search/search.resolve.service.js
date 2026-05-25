import BusinessListing from "../../model/businessListingSchema.js";
import City from "../../model/CitiesSchema.js";
import Category from "../../model/categoriesSchema.js";
import { parseSearchQuery } from "./search.utils.js";

/**
 * GET /api/search/resolve?q=...
 *
 * Called when user submits the search.
 * Returns a resolved intent so the frontend knows exactly where to navigate.
 *
 * Priority:
 *  1. Exact business name match  → redirect to /listing/{slug}
 *  2. Category or Tag match      → redirect to /{categorySlug}/{citySlug?}
 *  3. Multiple name matches      → return list of matching businesses
 *  4. Fallback                   → no_results
 */
export const searchResolveService = async (query, page = 1, limit = 20) => {
  if (!query?.trim()) return { intent: "no_results" };

  const {
    detectedCity,
    detectedCategory,
    detectedCategorySlug,
    normalizedQuery,
  } = await parseSearchQuery(query);

  const escape = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const skip = (page - 1) * limit;

  // ── PRIORITY 1: Exact Business Name Match ─────────────────────────────────
  const exactBusiness = await BusinessListing.findOne({
    businessName: { $regex: new RegExp(`^${escape(normalizedQuery)}$`, "i") },
    isDeleted: false,
    isPublished: true,
    status: "approved",
  }).lean();

  if (exactBusiness) {
    return {
      intent: "exact_business",
      redirectUrl: `/listing/${exactBusiness.slug}`,
      business: exactBusiness,
    };
  }

  // ── PRIORITY 2: Category or Tag detected ─────────────────────────────────
  if (detectedCategory) {
    let redirectUrl = `/${detectedCategorySlug}`;
    let cityDoc = null;

    if (detectedCity) {
      cityDoc = await City.findOne({
        name: { $regex: new RegExp(`^${escape(detectedCity)}$`, "i") },
      })
        .select("name slug")
        .lean();

      if (cityDoc) {
        redirectUrl = `/${detectedCategorySlug}/${cityDoc.slug}`;
      }
    }

    return {
      intent: detectedCity && cityDoc ? "category_city" : "category",
      redirectUrl,
      category: { name: detectedCategory, slug: detectedCategorySlug },
      city: cityDoc ? { name: cityDoc.name, slug: cityDoc.slug } : null,
    };
  }

  // ── PRIORITY 3: Multiple Business Name Matches ───────────────────────────
  const words = normalizedQuery.split(/\s+/).filter((w) => w.length > 1);
  if (words.length > 0) {
    const nameRegex = new RegExp(words.map(escape).join(".*"), "i");

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

    if (total > 0) {
      const results = data.results || [];
      const totalPages = Math.ceil(total / limit);

      return {
        intent: "business_list",
        listings: results,
        total,
        page: parseInt(page),
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      };
    }
  }

  return { intent: "no_results" };
};
