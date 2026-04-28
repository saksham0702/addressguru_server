import BusinessListing from "../model/businessListingSchema.js";
import JobsListing from "../model/jobsListingSchema.js";
import PropertyListing from "../model/propertiesListingSchema.js";
import MarketplaceListing from "../model/marketplaceListingSchema.js";
import Blogs from "../model/blogsSchema.js";
import Category from "../model/categoriesSchema.js";
import City from "../model/CitiesSchema.js";

const getModelBySection = (section) => {
  switch (section) {
    case "listing": return BusinessListing;
    case "jobs": return JobsListing;
    case "properties": return PropertyListing;
    case "marketplace": return MarketplaceListing;
    case "blogs": return Blogs;
    default: return null;
  }
};

const getBaseFilter = () => ({
  isDeleted: false,
  status: "approved",
  // isPublished: true, // If available
});

export const getRootSitemap = async (req, res) => {
  try {
    const sections = ["listing", "jobs", "properties", "marketplace", "blogs"];
    const result = [];

    for (const section of sections) {
      const Model = getModelBySection(section);
      if (!Model) continue;

      const filter = getBaseFilter();
      // Blogs schema might be slightly different
      if (section === "blogs") {
        delete filter.status; // Blogs may not have status field
      }

      const count = await Model.countDocuments(filter);
      if (count > 0) {
        const latest = await Model.findOne(filter).sort({ updatedAt: -1 }).select("updatedAt");
        result.push({
          section,
          url_count: count,
          last_updated: latest?.updatedAt?.toISOString() || new Date().toISOString(),
          image: latest?.coverImage || latest?.logo || (latest?.images && latest.images[0]) || null,
        });
      }
    }

    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error("Error in getRootSitemap:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getSectionSitemap = async (req, res) => {
  try {
    const { section } = req.params;
    const Model = getModelBySection(section);

    if (!Model) {
      return res.status(404).json({ success: false, message: "Section not found" });
    }

    const filter = getBaseFilter();
    if (section === "blogs") delete filter.status;

    // For blogs, we don't have categories/cities nesting usually, so we can just return all URLs
    if (section === "blogs") {
      const blogs = await Model.find(filter).select("slug updatedAt coverImage").sort({ updatedAt: -1 }).lean();
      const result = blogs.map(b => ({
        slug: b.slug,
        last_updated: b.updatedAt?.toISOString() || new Date().toISOString(),
        image: b.coverImage || null
      }));
      return res.status(200).json({ success: true, result });
    }

    // For listings, jobs, properties, marketplace -> aggregate by category
    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: "$category",
          url_count: { $sum: 1 },
          last_updated: { $max: "$updatedAt" }
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryDoc"
        }
      },
      { $unwind: "$categoryDoc" },
      {
        $project: {
          _id: 0,
          slug: "$categoryDoc.slug",
          url_count: 1,
          last_updated: 1,
          image: "$categoryDoc.iconPng"
        }
      }
    ];

    const result = await Model.aggregate(pipeline);
    
    // Format dates
    const formattedResult = result.map(item => ({
      ...item,
      last_updated: item.last_updated ? new Date(item.last_updated).toISOString() : new Date().toISOString()
    }));

    return res.status(200).json({ success: true, result: formattedResult });
  } catch (error) {
    console.error("Error in getSectionSitemap:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getSectionCategorySitemap = async (req, res) => {
  try {
    const { section, type: categorySlug } = req.params;
    const Model = getModelBySection(section);

    if (!Model || section === "blogs") {
      return res.status(404).json({ success: false, message: "Not applicable for this section" });
    }

    // Find category
    const category = await Category.findOne({ slug: categorySlug, isDeleted: false });
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    const filter = getBaseFilter();
    filter.category = category._id;

    // Aggregate by city
    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: "$city",
          url_count: { $sum: 1 },
          last_updated: { $max: "$updatedAt" }
        }
      },
      {
        $lookup: {
          from: "cities", // Assuming cities collection is named 'cities'
          localField: "_id",
          foreignField: "_id",
          as: "cityDoc"
        }
      },
      { $unwind: "$cityDoc" },
      {
        $project: {
          _id: 0,
          slug: "$cityDoc.slug",
          url_count: 1,
          last_updated: 1
        }
      }
    ];

    const result = await Model.aggregate(pipeline);
    
    const formattedResult = result.map(item => ({
      ...item,
      last_updated: item.last_updated ? new Date(item.last_updated).toISOString() : new Date().toISOString()
    }));

    return res.status(200).json({ success: true, result: formattedResult });
  } catch (error) {
    console.error("Error in getSectionCategorySitemap:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getCityListingsSitemap = async (req, res) => {
  try {
    const { section, slug: categorySlug, city: citySlug } = req.params;
    const Model = getModelBySection(section);

    if (!Model || section === "blogs") {
      return res.status(404).json({ success: false, message: "Not applicable for this section" });
    }

    const category = await Category.findOne({ slug: categorySlug, isDeleted: false });
    const city = await City.findOne({ slug: citySlug, deletedAt: null });

    if (!category || !city) {
      return res.status(404).json({ success: false, message: "Category or City not found" });
    }

    const filter = getBaseFilter();
    filter.category = category._id;
    filter.city = city._id;

    const listings = await Model.find(filter).select("slug updatedAt logo images").sort({ updatedAt: -1 }).lean();

    const result = listings.map(l => ({
      slug: l.slug,
      last_updated: l.updatedAt ? new Date(l.updatedAt).toISOString() : new Date().toISOString(),
      image: l.logo || (l.images && l.images[0]) || null
    }));

    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error("Error in getCityListingsSitemap:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
