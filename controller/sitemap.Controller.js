// controllers/sitemapController.js
import BusinessListing from "../model/businessListingSchema.js";
import JobsListing from "../model/jobsListingSchema.js";
import PropertyListing from "../model/propertiesListingSchema.js";
import MarketplaceListing from "../model/marketplaceListingSchema.js";

const SHARD_SIZE = 5000;

const getModelBySection = (section) => {
  switch (section) {
    case "listing":
      return BusinessListing;
    case "jobs":
      return JobsListing;
    case "properties":
      return PropertyListing;
    case "marketplace":
      return MarketplaceListing;
    default:
      return null;
  }
};

const getBaseFilter = () => ({
  isDeleted: false,
  status: "approved",
});

// ---------- ROOT: one row per section ----------
export const getRootSitemap = async (req, res) => {
  try {
    const sections = ["listing", "jobs", "properties", "marketplace"];
    const result = [];

    for (const section of sections) {
      const Model = getModelBySection(section);
      const filter = getBaseFilter();
      const count = await Model.countDocuments(filter);
      if (count > 0) {
        const latest = await Model.findOne(filter)
          .sort({ updatedAt: -1 })
          .select("updatedAt");
        result.push({
          section,
          url_count: count,
          last_updated:
            latest?.updatedAt?.toISOString() || new Date().toISOString(),
        });
      }
    }

    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error("Error in getRootSitemap:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ---------- SECTION META: total + shard count (used by all 4 index pages) ----------
export const getSectionMeta = async (req, res) => {
  try {
    const { section } = req.params;
    const Model = getModelBySection(section);
    if (!Model)
      return res
        .status(404)
        .json({ success: false, message: "Section not found" });

    const filter = getBaseFilter();
    const total = await Model.countDocuments(filter);
    const latest = await Model.findOne(filter)
      .sort({ updatedAt: -1 })
      .select("updatedAt");

    return res.status(200).json({
      success: true,
      total,
      totalShards: total > 0 ? Math.ceil(total / SHARD_SIZE) : 0,
      last_updated:
        latest?.updatedAt?.toISOString() || new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in getSectionMeta:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ---------- SHARDED SINGLE-PAGE URLS (jobs / marketplace / properties / listing) ----------
export const getShardedListings = async (req, res) => {
  try {
    const { section } = req.params;
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const Model = getModelBySection(section);
    if (!Model)
      return res
        .status(404)
        .json({ success: false, message: "Section not found" });

    const filter = getBaseFilter();
    const skip = (page - 1) * SHARD_SIZE;

    const docs = await Model.find(filter)
      .select("slug updatedAt logo images coverImage")
      .sort({ _id: 1 }) // stable order so shard boundaries don't shift between requests
      .skip(skip)
      .limit(SHARD_SIZE)
      .lean();

    const result = docs.map((d) => ({
      slug: d.slug,
      last_updated: d.updatedAt
        ? new Date(d.updatedAt).toISOString()
        : new Date().toISOString(),
      image: d.logo || d.coverImage || (d.images && d.images[0]) || null,
    }));

    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error("Error in getShardedListings:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ---------- BUSINESS ONLY: category+city archive page META ----------
export const getListingCategoryCityMeta = async (req, res) => {
  try {
    const filter = getBaseFilter();
    const pipeline = [
      { $match: filter },
      { $group: { _id: { category: "$category", city: "$city" } } },
      {
        $lookup: {
          from: "cities",
          localField: "_id.city",
          foreignField: "_id",
          as: "cityDoc",
        },
      },
      { $unwind: "$cityDoc" },
      { $match: { "cityDoc.slug": { $ne: "all-cities" } } },
      { $count: "total" },
    ];
    const rows = await BusinessListing.aggregate(pipeline);
    const total = rows[0]?.total || 0;

    const latest = await BusinessListing.findOne(filter)
      .sort({ updatedAt: -1 })
      .select("updatedAt");

    return res.status(200).json({
      success: true,
      total,
      totalShards: total > 0 ? Math.ceil(total / SHARD_SIZE) : 0,
      last_updated:
        latest?.updatedAt?.toISOString() || new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in getListingCategoryCityMeta:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ---------- BUSINESS ONLY: category+city archive page SHARD ----------
// e.g. /restaurants/dubai
export const getListingCategoryCityShard = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const skip = (page - 1) * SHARD_SIZE;
    const filter = getBaseFilter();

    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: { category: "$category", city: "$city" },
          last_updated: { $max: "$updatedAt" },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id.category",
          foreignField: "_id",
          as: "categoryDoc",
        },
      },
      { $unwind: "$categoryDoc" },
      {
        $lookup: {
          from: "cities",
          localField: "_id.city",
          foreignField: "_id",
          as: "cityDoc",
        },
      },
      { $unwind: "$cityDoc" },
      { $match: { "cityDoc.slug": { $ne: "all-cities" } } },
      { $sort: { "categoryDoc.slug": 1, "cityDoc.slug": 1 } },
      { $skip: skip },
      { $limit: SHARD_SIZE },
      {
        $project: {
          _id: 0,
          loc: { $concat: ["$categoryDoc.slug", "/", "$cityDoc.slug"] },
          last_updated: 1,
        },
      },
    ];

    const rows = await BusinessListing.aggregate(pipeline);
    const result = rows.map((r) => ({
      loc: r.loc,
      last_updated: r.last_updated
        ? new Date(r.last_updated).toISOString()
        : new Date().toISOString(),
    }));

    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error("Error in getListingCategoryCityShard:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
