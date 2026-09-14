// backend/modules/whatsapp-template/whatsappTemplate.controller.js
import path from "path";
import Template from "../../model/templateSchema.js";
import Plan from "../../model/plansSchema.js";
import { DEFAULT_TEMPLATES } from "./defaultTemplates.js";

/**
 * Seed default templates if they do not exist
 */
export const seedDefaultTemplates = async () => {
  try {
    for (const tpl of DEFAULT_TEMPLATES) {
      const exists = await Template.findOne({
        slug: tpl.slug,
        isDeleted: false,
      });
      if (!exists) {
        await Template.create(tpl);
        console.log(`[Templates Seed] Created default template: ${tpl.title}`);
      }
    }
    return { success: true, message: "Default templates seeded successfully" };
  } catch (error) {
    console.error("[Templates Seed] Error seeding templates:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * GET /whatsapp-template
 * Query: type (whatsapp|email), category, search
 */
export const getTemplates = async (req, res) => {
  try {
    const { type, category, search } = req.query;

    const filter = { isDeleted: false };
    if (type) filter.type = type.toLowerCase();
    if (category && category !== "all") filter.category = category;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }

    let templates = await Template.find(filter)
      .sort({ isSystem: -1, createdAt: -1 })
      .lean();

    // If database is completely empty, auto-seed defaults and re-fetch
    if (templates.length === 0 && !search && !category) {
      await seedDefaultTemplates();
      templates = await Template.find(filter)
        .sort({ isSystem: -1, createdAt: -1 })
        .lean();
    }

    return res.status(200).json({
      success: true,
      result: templates,
      data: templates,
      count: templates.length,
      message: "Templates retrieved successfully",
    });
  } catch (error) {
    console.error("getTemplates error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching templates",
      error: error.message,
    });
  }
};

/**
 * GET /whatsapp-template/:id
 */
export const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findOne({ _id: id, isDeleted: false });
    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error("getTemplateById error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching template",
      error: error.message,
    });
  }
};

/**
 * POST /whatsapp-template
 */
export const createTemplate = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { title, message, type, subject, category, variables, status } =
      req.body;

    if (!title?.trim() || !message?.trim() || !type) {
      return res.status(400).json({
        success: false,
        message: "Title, message, and type are required",
      });
    }

    let parsedVariables = [];
    if (Array.isArray(variables)) {
      parsedVariables = variables;
    } else if (typeof variables === "string") {
      try {
        parsedVariables = JSON.parse(variables);
      } catch {
        parsedVariables = variables.split(",").map((v) => v.trim()).filter(Boolean);
      }
    }

    let mediaUrl = null;
    let mediaType = null;
    let fileName = null;
    let fileSize = null;

    if (req.file) {
      mediaUrl = "/" + path.relative(process.cwd(), req.file.path).replace(/\\/g, "/");
      mediaType = req.file.mimetype.startsWith("image/")
        ? "image"
        : req.file.mimetype.startsWith("video/")
        ? "video"
        : req.file.mimetype.startsWith("audio/")
        ? "audio"
        : "document";
      fileName = req.file.originalname;
      fileSize = req.file.size;
    } else if (req.body.mediaUrl) {
      mediaUrl = req.body.mediaUrl;
      mediaType = req.body.mediaType || "document";
      fileName = req.body.fileName || path.basename(mediaUrl);
    }

    const slug =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/(^_|_$)/g, "") + `_${Date.now()}`;

    const newTemplate = await Template.create({
      title: title.trim(),
      slug,
      message: message.trim(),
      type: type.toLowerCase(),
      subject: subject?.trim() || null,
      category: category || "custom",
      variables: parsedVariables,
      mediaUrl,
      mediaType,
      fileName,
      fileSize,
      status: status || "active",
      isSystem: false,
      createdBy: userId || null,
    });

    return res.status(201).json({
      success: true,
      data: newTemplate,
      result: newTemplate,
      message: "Template created successfully",
    });
  } catch (error) {
    console.error("createTemplate error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error creating template",
      error: error.message,
    });
  }
};

/**
 * PUT /whatsapp-template/:id
 */
export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, type, subject, category, variables, status, removeMedia } =
      req.body;

    const updateFields = {};
    if (title !== undefined) updateFields.title = title.trim();
    if (message !== undefined) updateFields.message = message;
    if (type !== undefined) updateFields.type = type.toLowerCase();
    if (subject !== undefined) updateFields.subject = subject.trim();
    if (category !== undefined) updateFields.category = category;
    if (status !== undefined) updateFields.status = status;

    if (variables !== undefined) {
      if (Array.isArray(variables)) {
        updateFields.variables = variables;
      } else if (typeof variables === "string") {
        try {
          updateFields.variables = JSON.parse(variables);
        } catch {
          updateFields.variables = variables.split(",").map((v) => v.trim()).filter(Boolean);
        }
      }
    }

    if (req.file) {
      updateFields.mediaUrl = "/" + path.relative(process.cwd(), req.file.path).replace(/\\/g, "/");
      updateFields.mediaType = req.file.mimetype.startsWith("image/")
        ? "image"
        : req.file.mimetype.startsWith("video/")
        ? "video"
        : req.file.mimetype.startsWith("audio/")
        ? "audio"
        : "document";
      updateFields.fileName = req.file.originalname;
      updateFields.fileSize = req.file.size;
    } else if (removeMedia === "true" || removeMedia === true) {
      updateFields.mediaUrl = null;
      updateFields.mediaType = null;
      updateFields.fileName = null;
      updateFields.fileSize = null;
    }

    const updated = await Template.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updateFields },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: updated,
      result: updated,
      message: "Template updated successfully",
    });
  } catch (error) {
    console.error("updateTemplate error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating template",
      error: error.message,
    });
  }
};

/**
 * DELETE /whatsapp-template/:id
 */
export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Template.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error) {
    console.error("deleteTemplate error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error deleting template",
      error: error.message,
    });
  }
};

/**
 * POST /whatsapp-template/reset
 * Reset default system templates to initial values
 */
export const resetDefaultTemplates = async (req, res) => {
  try {
    for (const tpl of DEFAULT_TEMPLATES) {
      await Template.findOneAndUpdate(
        { slug: tpl.slug },
        {
          $set: {
            ...tpl,
            isDeleted: false,
          },
        },
        { upsert: true, new: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Default templates restored successfully",
    });
  } catch (error) {
    console.error("resetDefaultTemplates error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error resetting templates",
      error: error.message,
    });
  }
};

/**
 * GET /whatsapp-template/plans-pitch
 * Helper to fetch active business plans from Plan collection and format them nicely
 */
export const getPlansPitchSummary = async (req, res) => {
  try {
    const plans = await Plan.find({
      $or: [{ planType: "business" }, { planType: { $exists: false } }],
      isActive: { $ne: false },
      isDeleted: { $ne: true },
    })
      .sort({ displayOrder: 1, price: 1 })
      .lean();

    let formattedText = "";
    if (plans.length > 0) {
      formattedText = plans
        .map((p) => {
          const priceStr =
            p.price === 0
              ? "Free"
              : `${p.currency || "AED"} ${p.price}${
                  p.durationInDays ? ` / ${p.durationInDays} days` : ""
                }`;
          const tag = p.tagline ? ` (${p.tagline})` : "";
          return `🏷️ *${p.name}*${tag} — *${priceStr}*`;
        })
        .join("\n");
    } else {
      formattedText =
        "🏷️ *Starter Plan* — AED 99\n🏷️ *Growth Plan* — AED 299\n🏷️ *Premium Enterprise* — AED 599";
    }

    return res.status(200).json({
      success: true,
      data: {
        plans,
        formattedText,
      },
    });
  } catch (error) {
    console.error("getPlansPitchSummary error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching plans pitch",
      error: error.message,
    });
  }
};
