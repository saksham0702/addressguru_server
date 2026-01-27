import Feature from "../model/categoryFeaturesSchema.js";
import { successData, errorData } from "../services/helper.js";

/**
 * ✅ Get Feature by Type (facility / service / payment)
 */
export const getFeatureByType = async (req, res) => {
  try {
    const { type } = req.params;

    const feature = await Feature.findOne({
      type,
      isDeleted: false,
    });

    if (!feature) return errorData(res, 404, false, "Feature not found");

    return successData(res, 200, true, "Feature fetched successfully", feature);
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/**
 * ✅ Add item to Facility / Service / Payment
 */
export const addFeatureItem = async (req, res) => {
  try {
    const { type } = req.params;
    const { name, description } = req.body;

    if (!name) return errorData(res, 401, false, "Item name is required");

    const feature = await Feature.findOne({
      type,
      isDeleted: false,
    });

    if (!feature) return errorData(res, 404, false, "Feature not found");

    if (feature.isStatic)
      return errorData(res, 403, false, "Static feature cannot be modified");

    feature.items.push({ name, description });
    await feature.save();

    return successData(res, 200, true, "Item added successfully", feature);
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/**
 * ✅ Update Feature Item
 */
export const updateFeatureItem = async (req, res) => {
  try {
    const { type, itemId } = req.params;
    const { name, description, isActive } = req.body;

    const feature = await Feature.findOne({
      type,
      isDeleted: false,
    });

    if (!feature) return errorData(res, 404, false, "Feature not found");

    if (feature.isStatic)
      return errorData(res, 403, false, "Static feature cannot be modified");

    const item = feature.items.id(itemId);
    if (!item) return errorData(res, 404, false, "Item not found");

    if (name) item.name = name;
    if (description) item.description = description;
    if (typeof isActive === "boolean") item.isActive = isActive;

    await feature.save();

    return successData(res, 200, true, "Item updated successfully", feature);
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/**
 * ✅ Soft Delete Feature Item
 */
export const deleteFeatureItem = async (req, res) => {
  try {
    const { type, itemId } = req.params;

    const feature = await Feature.findOne({
      type,
      isDeleted: false,
    });

    if (!feature) return errorData(res, 404, false, "Feature not found");

    if (feature.isStatic)
      return errorData(res, 403, false, "Static feature cannot be modified");

    const item = feature.items.id(itemId);
    if (!item) return errorData(res, 404, false, "Item not found");

    item.isActive = false;
    await feature.save();

    return successData(res, 200, true, "Item deleted successfully", feature);
  } catch (error) {
    console.error(error);
    return errorData(res, 500, false, "Internal server error");
  }
};
