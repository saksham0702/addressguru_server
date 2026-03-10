import subCategory from "../model/subCategoriesSchema.js";
import Category from "../model/categoriesSchema.js";
import slugify from "slugify";
import { successData, errorData } from "../services/helper.js";

// ✅ Get SubCategories by Category Slug
export const getSubCategoriesByCategorySlug = async (req, res) => {
  console.log("categories", req.params);
  try {
    const { categorySlug } = req.params;

    const category = await Category.findOne({
      slug: categorySlug,
      isDeleted: false,
      isActive: true,
    });

    if (!category) return errorData(res, 404, false, "Category not found");

    const subs = await subCategory
      .find({
        category: category._id,
        isDeleted: false,
      })
      .sort({ createdAt: -1 });

    if (!subs.length)
      return errorData(res, 404, false, "No subcategories found");

    return successData(
      res,
      200,
      true,
      "Subcategories fetched successfully",
      subs,
    );
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ✅ Helper: Update hasSubCategories flag on parent category
const updateHasSubCategories = async (categoryId) => {
  const activeSubCount = await subCategory.countDocuments({
    category: categoryId,
    isDeleted: false,
  });
  await Category.findByIdAndUpdate(categoryId, {
    hasSubCategories: activeSubCount > 0,
  });
};

// ✅ Create SubCategory using Category Slug
export const createSubCategoryBySlug = async (req, res) => {
  console.log("body and params", req.body, req.params);
  try {
    const { categorySlug } = req.params;
    const { name, description, iconSvg, iconPng, seo } = req.body;

    if (!name)
      return errorData(res, 400, false, "SubCategory name is required");

    const category = await Category.findOne({
      slug: categorySlug,
      isDeleted: false,
      isActive: true,
    });

    if (!category) return errorData(res, 404, false, "Category not found");

    const slug = slugify(name, { lower: true });

    const exists = await subCategory.findOne({
      slug,
      category: category._id,
      isDeleted: false,
    });

    if (exists) return errorData(res, 409, false, "SubCategory already exists");

    const newSubCategory = await subCategory.create({
      name,
      slug,
      category: category._id,
      description,
      iconSvg,
      iconPng,
      seo,
    });

    // 🔥 Auto-update hasSubCategories on parent
    await updateHasSubCategories(category._id);

    return successData(
      res,
      201,
      true,
      "SubCategory created successfully",
      newSubCategory,
    );
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ✅ Create SubCategory (ID-based)
export const createSubCategory = async (req, res) => {
  try {
    const { name, category, description, iconSvg, iconPng, seo } = req.body;

    if (!name || !category)
      return errorData(res, 400, false, "Required fields missing");

    const parent = await Category.findOne({
      _id: category,
      isDeleted: false,
    });

    if (!parent) return errorData(res, 404, false, "Parent category not found");

    const slug = slugify(name, { lower: true });

    const exists = await subCategory.findOne({
      slug,
      category,
      isDeleted: false,
    });

    if (exists) return errorData(res, 409, false, "SubCategory already exists");

    const newSubCategory = await subCategory.create({
      name,
      slug,
      category,
      description,
      iconSvg,
      iconPng,
      seo,
    });

    // 🔥 Auto-update hasSubCategories on parent
    await updateHasSubCategories(category);

    return successData(
      res,
      201,
      true,
      "SubCategory created successfully",
      newSubCategory,
    );
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ✅ Get All SubCategories
export const getSubCategories = async (req, res) => {
  try {
    const subCategories = await subCategory
      .find({ isDeleted: false })
      .populate("category")
      .sort({ createdAt: -1 });

    if (!subCategories || subCategories.length === 0)
      return errorData(res, 404, false, "SubCategory not found.");

    return successData(
      res,
      200,
      true,
      "Get all subcategories successfully",
      subCategories,
    );
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ✅ Get SubCategories by Category ID
export const getSubCategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const subs = await subCategory
      .find({
        category: categoryId,
        isDeleted: false,
      })
      .sort({ createdAt: -1 });

    if (!subs || subs.length === 0)
      return errorData(res, 404, false, "SubCategory not found.");

    return successData(res, 200, true, "Get subcategories successfully", subs);
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ✅ Update SubCategory
export const updateSubCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.name) {
      updateData.slug = slugify(updateData.name, { lower: true });
    }

    if (updateData.category) {
      delete updateData.category; // prevent parent change
    }

    const updated = await subCategory.findOneAndUpdate(
      { _id: id, isDeleted: false },
      updateData,
      { new: true },
    );

    if (!updated) return errorData(res, 404, false, "SubCategory not found.");

    return successData(
      res,
      200,
      true,
      "SubCategory updated successfully",
      updated,
    );
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ✅ Soft Delete SubCategory
export const deleteSubCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const sub = await subCategory.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!sub) return errorData(res, 404, false, "SubCategory not found.");

    sub.isDeleted = true;
    sub.isActive = false;
    await sub.save();

    // 🔥 Re-evaluate hasSubCategories after deletion
    await updateHasSubCategories(sub.category);

    return successData(res, 200, true, "SubCategory deleted successfully", sub);
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};

export const getSingleSubCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const sub = await subCategory.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!sub) return errorData(res, 404, false, "SubCategory not found.");

    return successData(res, 200, true, "Get subcategory successfully", sub);
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};