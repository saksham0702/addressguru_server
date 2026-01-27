import Category from "../model/categoriesSchema.js";
import slugify from "slugify";
import { successData, errorData } from "../services/helper.js";

// ✅ Create Category
export const createCategory = async (req, res) => {
  try {
    const { name, description, color, type, textColor, iconSvg, iconPng, seo } =
      req.body;

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
      seo,
    });

    return successData(
      res,
      200,
      true,
      "Category created successfully",
      category
    );
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ✅ Get All Categories
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      isDeleted: false,
    }).sort({ createdAt: -1 });

    if (!categories || categories.length === 0)
      return errorData(res, 404, false, "Category not found.");

    return successData(
      res,
      200,
      true,
      "Get all categories successfully",
      categories.filter((category) => category.isDeleted === false)
    );
  } catch (error) {
    console.error(error);
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
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ✅ Update Category
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.name) {
      updateData.slug = slugify(updateData.name, { lower: true });
    }

    const updated = await Category.findOneAndUpdate(
      { _id: id, isDeleted: false },
      updateData,
      { new: true }
    );

    if (!updated) return errorData(res, 404, false, "Category not found.");

    return successData(
      res,
      200,
      true,
      "Category updated successfully",
      updated
    );
  } catch (error) {
    console.error(error);
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
      category
    );
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};
  