import Category from "../model/categoriesSchema.js";
import slugify from "slugify";
import { successData, errorData } from "../services/helper.js";

// ✅ Create Category
export const createCategory = async (req, res) => {
  console.log(req.body);
  console.log(req.file);
  try {
    const {
      name,
      description,
      color,
      type,
      textColor,
      iconSvg,
      iconPng,
      metaTitle,
      metaDescription,
    } = req.body;

    // parse tags safely
    let tags = [];

    if (req.body.tags) {
      try {
        tags = JSON.parse(req.body.tags);
      } catch (err) {
        tags = [];
      }
    }

    // ✅ handle ogImage upload
    let ogImage = "";
    if (req.file) {
      ogImage = req.file.path;
    }

    if (!name) return errorData(res, 401, false, "Category name is required");
    if (!type) return errorData(res, 401, false, "Category type is required");

    const slug = slugify(name, { lower: true });

    const exists = await Category.findOne({ slug, isDeleted: false });
    if (exists) return errorData(res, 409, false, "Category already exists");

    const category = await Category.create({
      name,
      slug,
      description,
      color,
      type,
      textColor,
      iconSvg,
      iconPng,

      tags: Array.isArray(tags) ? tags.map((t) => t.toLowerCase().trim()) : [],

      // ✅ NEW FIELDS
      seo: {
        title: metaTitle,
        description: metaDescription,
        ogImage: ogImage,
      },
    });

    return successData(
      res,
      200,
      true,
      "Category created successfully",
      category,
    );
  } catch (error) {
    console.warn(error);
    return errorData(res, 500, false, "Internal server error");
  }
};
// ✅ Get All Categories
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      isDeleted: false,
    }).sort({ isPopular: -1, createdAt: -1 });

    if (!categories || categories.length === 0)
      return errorData(res, 404, false, "Category not found.");

    return successData(
      res,
      200,
      true,
      "Get all categories successfully",
      categories, // ✅ removed redundant .filter(), already queried isDeleted: false
    );
  } catch (error) {
    console.warn(error);
    return errorData(res, 500, false, "Internal server error");
  }
};
// ✅ Update Category
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const existingCategory = await Category.findOne({
      _id: id,
      isDeleted: false,
    });
    if (!existingCategory) {
      return errorData(res, 404, false, "Category not found.");
    }
    const {
      name,
      description,
      color,
      type,
      textColor,
      iconSvg,
      iconPng,
      metaTitle,
      metaDescription,
      isPopular,
    } = req.body;

    // parse tags safely
    let tags = existingCategory.tags || [];

    if (req.body.tags) {
      try {
        tags = JSON.parse(req.body.tags);
      } catch (err) {
        tags = existingCategory.tags || [];
      }
    }

    // preserve old image if no new upload
    const ogImage = req.file
      ? req.file.path
      : existingCategory?.seo?.ogImage || "";

    const updated = await Category.findByIdAndUpdate(
      id,
      {
        name,
        slug: name ? slugify(name, { lower: true }) : existingCategory.slug,
        isPopular,
        description,
        color,
        type,
        textColor,
        iconSvg,
        iconPng,

        tags: Array.isArray(tags)
          ? tags.map((t) => t.toLowerCase().trim())
          : existingCategory.tags,

        seo: {
          title: metaTitle,
          description: metaDescription,
          ogImage,
        },
      },
      { new: true },
    );

    return successData(
      res,
      200,
      true,
      "Category updated successfully",
      updated,
    );
  } catch (error) {
    console.warn(error);
    return errorData(res, 500, false, "Internal server error");
  }
};
export const getCategoryByType = async (req, res) => {
  try {
    const { type } = req.params;

    const category = await Category.find({
      type,
      isDeleted: false,
    }).sort({
      isPopular: -1, // ✅ popular categories first
      createdAt: -1, // ✅ newest inside each group
    });

    if (!category || category.length === 0) {
      return errorData(res, 404, false, "Category not found.");
    }

    return successData(res, 200, true, "Get category successfully", category);
  } catch (error) {
    console.warn(error);
    return errorData(res, 500, false, "Internal server error");
  }
};
// ✅ Get Category by ID
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!category) return errorData(res, 404, false, "Category not found.");

    return successData(res, 200, true, "Get category successfully", category);
  } catch (error) {
    console.warn(error);
    return errorData(res, 500, false, "Internal server error");
  }
};
// ✅ Soft Delete Category
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!category) return errorData(res, 404, false, "Category not found.");

    category.isDeleted = true;
    category.isActive = false;
    await category.save();

    return successData(
      res,
      200,
      true,
      "Category deleted successfully",
      category,
    );
  } catch (error) {
    console.warn(error);
    return errorData(res, 500, false, "Internal server error");
  }
};
