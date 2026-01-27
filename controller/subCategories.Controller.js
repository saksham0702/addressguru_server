import subCategory from "../model/subCategoriesSchema.js";
import Category from "../model/categoriesSchema.js";
import slugify from "slugify";
import { successData, errorData } from "../services/helper.js";

// ✅ Create SubCategory
export const createSubCategory = async (req, res) => {
  try {
    const { name, category, description, iconSvg, iconPng, seo } = req.body;

    if (!name || !category)
      return errorData(res, 401, false, "Required fields missing");

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

    const subCategory = await subCategory.create({
      name,
      slug,
      category,
      description,
      iconSvg,
      iconPng,
      seo,
    });

    return successData(
      res,
      200,
      true,
      "SubCategory created successfully",
      subCategory
    );
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ✅ Get All SubCategories
export const getSubCategories = async (req, res) => {
  try {
    const subCategories = await subCategory.find({
      isDeleted: false,
    })
      .populate("category")
      .sort({ createdAt: -1 });

    if (!subCategories || subCategories.length === 0)
      return errorData(res, 404, false, "SubCategory not found.");

    return successData(
      res,
      200,
      true,
      "Get all subcategories successfully",
      subCategories
    );
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ✅ Get SubCategories by Category
export const getSubCategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const subs = await subCategory.find({
      category: categoryId,
      isDeleted: false,
    }).sort({ createdAt: -1 });

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
      { new: true }
    );

    if (!updated) return errorData(res, 404, false, "SubCategory not found.");

    return successData(
      res,
      200,
      true,
      "SubCategory updated successfully",
      updated
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

    return successData(res, 200, true, "SubCategory deleted successfully", sub);
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};
