import SeoContent from "../model/seoContentSchema.js";
import { successData, errorData } from "../services/helper.js";
import Category from "../model/categoriesSchema.js";
import CitiesSchema from "../model/CitiesSchema.js";

// CREATE / UPDATE SEO CONTENT
export const upsertSeoContent = async (req, res) => {
  console.log("req.body", req.body);
  try {
    const {
      category_id,
      city_id,
      city_content,
      seo_content,
      pricing_content,
      faq_content,
    } = req.body;

    // VALIDATION
    if (!category_id || !city_id) {
      return errorData(res, 400, false, "Category & city is required");
    }

    // CHECK CATEGORY
    const categoryExists = await Category.findOne({
      _id: category_id,
      isDeleted: false,
    });

    if (!categoryExists) {
      return errorData(res, 404, false, "Category not found");
    }

    // CHECK CITY
    const cityExists = await CitiesSchema.findOne({
      _id: city_id,
      deletedAt: null,
    });

    if (!cityExists) {
      return errorData(res, 404, false, "City not found");
    }

    // 🧠 HANDLE FAQ (STRING → ARRAY)
    let parsedFaq = [];

    if (typeof faq_content === "string" && faq_content.trim()) {
      try {
        parsedFaq = JSON.parse(faq_content);
      } catch {
        return errorData(res, 400, false, "Invalid FAQ format");
      }
    } else if (Array.isArray(faq_content)) {
      parsedFaq = faq_content;
    }

    // CHECK EXISTING
    const existing = await SeoContent.findOne({
      category_id,
      city_id,
      isDeleted: false,
    });

    const payload = {
      category_id,
      city_id,
      city_content,
      seo_content: seo_content || "",
      pricing_content: pricing_content || "",
      faq_content: parsedFaq,
    };

    let data;

    if (existing) {
      data = await SeoContent.findByIdAndUpdate(existing._id, payload, {
        new: true,
      });
    } else {
      data = await SeoContent.create(payload);
    }

    return successData(res, 200, true, existing ? "Updated" : "Created", data);
  } catch (err) {
    console.error("UPSERT ERROR:", err);
    return errorData(res, 500, false, err.message);
  }
};

// GET ALL SEO CONTENT
export const getAllSeoContent = async (req, res) => {
  try {
    const data = await SeoContent.find({
      isDeleted: false,
    })
      .populate("category_id", "name slug")
      .populate("city_id", "name slug")
      .sort({ updatedAt: -1 });

    return successData(res, 200, true, "All SEO content", data);
  } catch (err) {
    console.error("GET ALL SEO ERROR:", err);

    return errorData(res, 500, false, err.message);
  }
};

// DELETE SEO CONTENT
export const deleteSeoContent = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await SeoContent.findById(id);

    if (!existing) {
      return errorData(res, 404, false, "SEO content not found");
    }

    await SeoContent.findByIdAndUpdate(id, {
      isDeleted: true,
    });

    return successData(res, 200, true, "SEO content deleted");
  } catch (err) {
    console.error("DELETE SEO ERROR:", err);

    return errorData(res, 500, false, err.message);
  }
};

// GET SEO BY SLUG
export const getSeoBySlug = async (req, res) => {
  try {
    const { category_slug, city_slug } = req.query;

    if (!category_slug || !city_slug) {
      return errorData(
        res,
        400,
        false,
        "Category slug and city slug are required",
      );
    }

    const category = await Category.findOne({
      slug: category_slug,
      isDeleted: false,
    });

    if (!category) {
      return errorData(res, 404, false, "Category not found");
    }

    const city = await CitiesSchema.findOne({
      slug: city_slug,
      isDeleted: false,
    });

    if (!city) {
      return errorData(res, 404, false, "City not found");
    }

    const seoContent = await SeoContent.findOne({
      category_id: category._id,
      city_id: city._id,
      isDeleted: false,
    });

    if (!seoContent) {
      return successData(res, 200, true, "Fallback", {
        city_content: "",
        seo_content: "",
        pricing_content: "",
        faq_content: [],
      });
    }

    return successData(res, 200, true, "Fetched", seoContent);
  } catch (err) {
    console.error("GET BY SLUG ERROR:", err);
    return errorData(res, 500, false, err.message);
  }
};
