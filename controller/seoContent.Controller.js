import SeoContent from "../model/seoContentSchema.js";
import { successData, errorData } from "../services/helper.js";
import Category from "../model/categoriesSchema.js";
import CitiesSchema from "../model/CitiesSchema.js";

export const upsertSeoContent = async (req, res) => {
  try {
    const {
      category_id,
      city_ids = [], // array
      title,
      content,
      meta_title,
      meta_description,
    } = req.body;

    if (!category_id || !content) {
      return errorData(res, 400, false, "Category & content required");
    }

    // prevent duplicate (same category + same cities)
    const existing = await SeoContent.findOne({
      category_id,
      city_ids: { $all: city_ids, $size: city_ids.length },
      isDeleted: false,
    });

    let data;

    if (existing) {
      data = await SeoContent.findByIdAndUpdate(
        existing._id,
        { title, content, meta_title, meta_description },
        { new: true }
      );
    } else {
      data = await SeoContent.create({
        category_id,
        city_ids,
        title,
        content,
        meta_title,
        meta_description,
      });
    }

    return successData(res, 200, true, "Saved", data);
  } catch (err) {
    return errorData(res, 500, false, err.message);
  }
};

export const getAllSeoContent = async (req, res) => {
  try {
    const data = await SeoContent.find({ isDeleted: false })
      .populate("category_id", "name slug")
      .populate("city_ids", "name slug");

    return successData(res, 200, true, "All SEO content", data);
  } catch (err) {
    return errorData(res, 500, false, err.message);
  }
};

export const deleteSeoContent = async (req, res) => {
  try {
    const { id } = req.params;

    await SeoContent.findByIdAndUpdate(id, { isDeleted: true });

    return successData(res, 200, true, "Deleted");
  } catch (err) {
    return errorData(res, 500, false, err.message);
  }
};

export const getSeoBySlug = async (req, res) => {

  try {
    const { category_slug, city_slug } = req.query;

    if (!category_slug) {
      return errorData(res, 400, false, "Category slug required");
    }

    const category = await Category.findOne({
      slug: category_slug,
      isDeleted: false,
    });

    if (!category) {
      return errorData(res, 404, false, "Category not found");
    }

    let city = null;

    if (city_slug) {
      city = await CitiesSchema.findOne({ slug: city_slug });
    }

    let seoContent = null;

    // 1️⃣ Try city-specific
    if (city) {
      seoContent = await SeoContent.findOne({
        category_id: category._id,
        city_ids: city._id,
        isDeleted: false,
        isActive: true,
      });
    }

    // 2️⃣ fallback to default (no city assigned)
    if (!seoContent) {
      seoContent = await SeoContent.findOne({
        category_id: category._id,
        city_ids: { $size: 0 },
        isDeleted: false,
        isActive: true,
      });
    }

    return successData(res, 200, true, "SEO data", {
      title: seoContent?.title || category?.seo?.title || category?.name,

      content: seoContent?.content || "",

      meta_title:
        seoContent?.meta_title || category?.seo?.title,

      meta_description:
        seoContent?.meta_description ||
        category?.seo?.description,
    });
  } catch (err) {
    return errorData(res, 500, false, err.message);
  }
};

// export const getSeoContent = async (req, res) => {
//   try {
//     const { category_id, city_id } = req.query;

//     if (!category_id) {
//       return errorData(res, 400, false, "Category id is required");
//     }

//     // 1️⃣ Try city-specific content
//     let seoContent = await SeoContent.findOne({
//       category_id,
//       city_id,
//       isDeleted: false,
//       isActive: true,
//     });

//     // 2️⃣ Fallback to default
//     if (!seoContent) {
//       seoContent = await SeoContent.findOne({
//         category_id,
//         city_id: null,
//         isDeleted: false,
//         isActive: true,
//       });
//     }

//     // 3️⃣ Get category SEO fallback
//     const category = await Category.findById(category_id).select("seo name");

//     return successData(res, 200, true, "SEO content fetched", {
//       title: seoContent?.title || category?.seo?.title || category?.name,
//       content: seoContent?.content || "",
//       meta_title: seoContent?.meta_title || category?.seo?.title,
//       meta_description:
//         seoContent?.meta_description || category?.seo?.description,
//     });
//   } catch (error) {
//     console.error("SEO Fetch Error:", error);
//     return errorData(res, 500, false, "Internal server error");
//   }
// };

