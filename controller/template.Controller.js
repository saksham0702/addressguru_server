import Template from "../model/templateSchema.js";
import {
  addTemplateSchema,
  updateTemplateSchema,
} from "../validations/template.validator.js";

// @desc    Get templates mapped by type and user
// @route   GET /api/template/?type=whatsapp
// @access  Private
export const getTemplates = async (req, res) => {
  try {
    const { type } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const filter = { createdBy: userId, isDeleted: false };
    if (type) {
      filter.type = type.toLowerCase();
    }

    const templates = await Template.find(filter).sort({ createdAt: -1 });

    // API expects `{ result: [...] }` to map to `res?.result` in frontend
    return res.status(200).json({
      success: true,
      result: templates,
      message: "Templates retrieved successfully",
    });
  } catch (error) {
    console.warn("getTemplates:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Add a new template
// @route   POST /api/template/add
// @access  Private
export const addTemplate = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { error, value } = addTemplateSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      const errorMessages = {};
      error.details.forEach((err) => {
        errorMessages[err.path[0]] = [err.message];
      });
      return res.status(400).json({ success: false, errors: errorMessages });
    }

    const newTemplate = await Template.create({
      ...value,
      createdBy: userId,
    });

    return res.status(201).json({
      success: true,
      result: newTemplate,
      message: "Template created successfully",
    });
  } catch (error) {
    console.warn("addTemplate:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update an existing template
// @route   PUT /api/template/update/:id
// @access  Private
export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { error, value } = updateTemplateSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      const errorMessages = {};
      error.details.forEach((err) => {
        errorMessages[err.path[0]] = [err.message];
      });
      return res.status(400).json({ success: false, errors: errorMessages });
    }

    const template = await Template.findOneAndUpdate(
      { _id: id, createdBy: userId, isDeleted: false },
      { $set: value },
      { new: true }
    );

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    return res.status(200).json({
      success: true,
      result: template,
      message: "Template updated successfully",
    });
  } catch (error) {
    console.warn("updateTemplate:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete a template (soft delete)
// @route   DELETE /api/template/delete/:id
// @access  Private
export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const template = await Template.findOneAndUpdate(
      { _id: id, createdBy: userId, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error) {
    console.warn("deleteTemplate:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
