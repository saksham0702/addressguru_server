import AdditionalField from "../model/additionalFieldSchema.js";
import { successData, errorData } from "../services/helper.js";

// ============================================
// HELPER — pick only allowed body keys
// ============================================
const CREATABLE_FIELDS = [
  "category_id",
  "subcategory_id",
  "field_label",
  "field_type",
  "is_logo",
  "is_quickinfo",
  "is_description",
  "is_additional",
  "is_inside_form",
  "checkbox_items",
  "dropdown_items",
  "is_filter_out",
  "is_required",
  "placeholder",
];

const UPDATABLE_FIELDS = [
  "field_label",
  "field_type",
  "is_logo",
  "is_quickinfo",
  "is_description",
  "is_additional",
  "is_inside_form",
  "checkbox_items",
  "dropdown_items",
  "is_filter_out",
  "is_required",
  "placeholder",
  "is_active",
];

// create field
export const createField = async (req, res) => {
  try {
    const { category_id, field_label, field_type } = req.body;

    if (!category_id || !field_label || !field_type) {
      return errorData(
        res,
        400,
        false,
        "category_id, field_label and field_type are required",
        null,
        null,
      );
    }

    // Build the document from allowed fields only
    const fieldData = {};
    CREATABLE_FIELDS.forEach((key) => {
      if (req.body[key] !== undefined) fieldData[key] = req.body[key];
    });

    const field = new AdditionalField({
      ...fieldData,
      subcategory_id: fieldData.subcategory_id || null,
      created_by: req.user?.id || null,
    });

    await field.save();

    return successData(res, 201, true, "Field created successfully", field);
  } catch (error) {
    if (error.code === 11000) {
      return errorData(
        res,
        409,
        false,
        "A field already exists for the given category/subcategory",
        null,
        error.message,
      );
    }
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((e) => e.message)
        .join(", ");
      return errorData(res, 400, false, message, null, error.message);
    }

    console.warn("Create field error:", error);
    return errorData(
      res,
      500,
      false,
      "Internal server error",
      null,
      error.message,
    );
  }
};

// get fields by category
export const getFields = async (req, res) => {
  try {
    const { category_id, subcategory_id, is_active, is_inside_form } =
      req.query;
    if (!category_id) {
      return errorData(res, 400, false, "category_id is required", null, null);
    }

    const filter = {
      category_id,
      subcategory_id: subcategory_id || null,
      is_deleted: false,
    };

    if (is_active !== undefined) {
      filter.is_active = is_active === "true";
    }

    if (is_inside_form !== undefined) {
      filter.is_inside_form = is_inside_form === "true";
    }

    if (is_active !== undefined) {
      filter.is_active = is_active === "true";
    }

    const fields = await AdditionalField.find(filter).sort({
      createdAt: 1, // ✅ replaced display_order
    });

    if (fields.length > 0) {
      return successData(res, 200, true, "Fields fetched successfully", fields);
    } else {
      return errorData(res, 404, false, "No fields found", null, null);
    }
  } catch (error) {
    console.warn("Get fields error:", error);
    return errorData(
      res,
      500,
      false,
      "Internal server error",
      null,
      error.message,
    );
  }
};

// get single field by id
export const getField = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return errorData(res, 400, false, "Field ID is required", null, null);
    }

    const field = await AdditionalField.findOne({ _id: id, is_deleted: false });

    if (field) {
      return successData(res, 200, true, "Field fetched successfully", field);
    } else {
      return errorData(res, 404, false, "Field not found", null, null);
    }
  } catch (error) {
    console.warn("Get field error:", error);
    return errorData(
      res,
      500,
      false,
      "Internal server error",
      null,
      error.message,
    );
  }
};

// update field by id
export const updateField = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return errorData(res, 400, false, "Field ID is required", null, null);
    }

    const field = await AdditionalField.findOne({ _id: id, is_deleted: false });

    if (!field) {
      return errorData(res, 404, false, "Field not found", null, null);
    }

    // Apply only allowed updates
    UPDATABLE_FIELDS.forEach((key) => {
      if (req.body[key] !== undefined) {
        field[key] = req.body[key];
      }
    });

    await field.save();

    return successData(res, 200, true, "Field updated successfully", field);
  } catch (error) {
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((e) => e.message)
        .join(", ");
      return errorData(res, 400, false, message, null, error.message);
    }

    console.warn("Update field error:", error);
    return errorData(
      res,
      500,
      false,
      "Internal server error",
      null,
      error.message,
    );
  }
};

// soft delete field by id
export const deleteField = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return errorData(res, 400, false, "Field ID is required", null, null);
    }

    const field = await AdditionalField.findOne({ _id: id, is_deleted: false });

    if (!field) {
      return errorData(res, 404, false, "Field not found", null, null);
    }

    field.is_deleted = true;
    field.deleted_at = new Date();
    field.is_active = false;

    await field.save();

    return successData(res, 200, true, "Field deleted successfully", null);
  } catch (error) {
    console.warn("Delete field error:", error);
    return errorData(
      res,
      500,
      false,
      "Internal server error",
      null,
      error.message,
    );
  }
};
