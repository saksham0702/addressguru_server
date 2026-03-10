import AdditionalField from "../model/additionalFieldSchema.js";
import { successData, errorData } from "../services/helper.js";

// ============================================
// CREATE
// ============================================
export const createField = async (req, res) => {

  try {
    const {
      category_id,
      subcategory_id,
      // field_name,
      field_label,
      field_type,
      checkbox_items,
      radio_items,
      dropdown_items,
      is_required,
      min_length,
      max_length,
      min_value,
      max_value,
      validation_type,  
      error_message,
      placeholder,
      help_text,
      default_value,
      display_order,
      show_in_filter,
    } = req.body;

    console.log("body", req.body);

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

    const field = new AdditionalField({
      category_id,
      subcategory_id: subcategory_id || null,
    //   field_name,
      field_label,
      field_type,
      checkbox_items,
      radio_items,
      dropdown_items,
      is_required,
      min_length,
      max_length,
      min_value,
      max_value,
      validation_type,
      error_message,
      placeholder,
      help_text,
      default_value,
      display_order,
      show_in_filter,
      created_by: req.user?._id || null,
    });

    await field.save();

    return successData(res, 201, true, "Field created successfully", field);
  } catch (error) {
    if (error.code === 11000) {
      return errorData(
        res,
        409,
        false,
        "A field with this name already exists for the given category/subcategory",
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

    console.error("Create field error:", error);
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

// ============================================
// GET ALL (by category_id / subcategory_id)
// ============================================
export const getFields = async (req, res) => {
  try {
    const { category_id, subcategory_id, show_in_filter, is_active } =
      req.query;

    if (!category_id) {
      return errorData(res, 400, false, "category_id is required", null, null);
    }

    const filter = {
      category_id,
      subcategory_id: subcategory_id || null,
      is_deleted: false,
    };

    if (show_in_filter !== undefined)
      filter.show_in_filter = show_in_filter === "true";

    if (is_active !== undefined) filter.is_active = is_active === "true";

    const fields = await AdditionalField.find(filter).sort({
      display_order: 1,
    });

    if (fields.length > 0) {
      return successData(res, 200, true, "Fields fetched successfully", fields);
    } else {
      return errorData(res, 404, false, "No fields found", null, null);
    }
  } catch (error) {
    console.error("Get fields error:", error);
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

// ============================================
// GET ONE BY ID
// ============================================
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
    console.error("Get field error:", error);
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

// ============================================
// UPDATE
// ============================================
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

    // These are locked after creation - strip them out
    const {
      category_id,
      subcategory_id,
      //   field_name,
      created_by,
      ...updateData
    } = req.body;

    const allowedUpdates = [
      "field_label",
      "field_type",
      "checkbox_items",
      "radio_items",
      "dropdown_items",
      "is_required",
      "min_length",
      "max_length",
      "min_value",
      "max_value",
      "pattern",
      "error_message",
      "placeholder",
      "help_text",
      "default_value",
      "display_order",
      "is_active",
      "show_in_filter",
    ];

    allowedUpdates.forEach((key) => {
      if (updateData[key] !== undefined) {
        field[key] = updateData[key];
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

    console.error("Update field error:", error);
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

// ============================================
// SOFT DELETE
// ============================================
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
    console.error("Delete field error:", error);
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
