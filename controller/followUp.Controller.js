import FollowUp from "../model/followUpSchema.js";
import FollowUpConfig from "../model/followUpConfigSchema.js";

const VALID_MODULES = [
  "BusinessListing",
  "MarketplaceListing",
  "PropertyListing",
  "JobListing",
];

const CONFIG_MODULE = "lead"; // ✅ config is always this

// ── CREATE ────────────────────────────────────────────────────────────────────
export const createFollowUp = async (req, res) => {
  try {
    const { listingId, activityOptionId, remark, nextFollowUpDate } = req.body;
    const createdBy = req.user.id;
    const module = req.query.module || req.body.module;

    if (!module || !VALID_MODULES.includes(module)) {
      return res.status(400).json({
        success: false,
        message: `module is required. Must be one of: ${VALID_MODULES.join(", ")}`,
      });
    }

    if (!listingId || !activityOptionId) {
      return res.status(400).json({
        success: false,
        message: "listingId and activityOptionId are required",
      });
    }

    // ✅ FIXED — always fetch the single shared config
    const config = await FollowUpConfig.findOne({ module: CONFIG_MODULE });
    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Follow-up config not found. Please seed the config first.",
      });
    }

    const option = config.options.id(activityOptionId);
    if (!option || !option.isActive) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive activity option",
      });
    }

    if (option.remarkRequired && !remark?.trim()) {
      return res.status(400).json({
        success: false,
        message: `Remark is required for "${option.label}"`,
      });
    }

    const followUp = await FollowUp.create({
      listing: listingId,
      module, // ✅ listing module stored here
      activityOptionId,
      reason: option.label,
      remark: option.hasRemark ? remark?.trim() : null,
      nextFollowUpDate: nextFollowUpDate || null,
      createdBy,
    });

    await followUp.populate("createdBy", "name email");

    return res.status(201).json({
      success: true,
      message: "Follow-up logged successfully",
      data: followUp,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET follow-ups for a listing ──────────────────────────────────────────────
export const getFollowUpsByListing = async (req, res) => {
  try {
    const { listingId } = req.params;
    const module = req.query.module;

    if (!module || !VALID_MODULES.includes(module)) {
      return res.status(400).json({
        success: false,
        message: `module is required. Must be one of: ${VALID_MODULES.join(", ")}`,
      });
    }

    const followUps = await FollowUp.find({
      listing: listingId,
      module,
      isDeleted: false,
    })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: followUps.length,
      data: followUps,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET single follow-up ──────────────────────────────────────────────────────
export const getFollowUpById = async (req, res) => {
  try {
    const followUp = await FollowUp.findById(req.params.id).populate(
      "createdBy",
      "name email",
    );

    if (!followUp) {
      return res
        .status(404)
        .json({ success: false, message: "Follow-up not found" });
    }

    return res.status(200).json({ success: true, data: followUp });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── SOFT DELETE follow-up ─────────────────────────────────────────────────────
export const deleteFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true },
    );

    if (!followUp) {
      return res
        .status(404)
        .json({ success: false, message: "Follow-up not found" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Follow-up deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET config (always "lead") ────────────────────────────────────────────────
// GET /api/followup-config
export const getConfig = async (req, res) => {
  try {
    // ✅ FIXED — no module param needed, always "lead"
    let config = await FollowUpConfig.findOne({ module: CONFIG_MODULE });

    if (!config) {
      config = await FollowUpConfig.create({
        module: CONFIG_MODULE, // ✅ seed as "lead"
        options: [
          {
            label: "Call Back Later",
            hasRemark: false,
            remarkRequired: false,
            order: 0,
          },
          {
            label: "Call Me Tomorrow",
            hasRemark: false,
            remarkRequired: false,
            order: 1,
          },
          {
            label: "Payment Tomorrow",
            hasRemark: true,
            remarkRequired: false,
            order: 2,
          },
          {
            label: "Talk With My Partner",
            hasRemark: false,
            remarkRequired: false,
            order: 3,
          },
          {
            label: "Work With Other Company",
            hasRemark: true,
            remarkRequired: true,
            order: 4,
          },
          {
            label: "Not Interested",
            hasRemark: true,
            remarkRequired: true,
            order: 5,
          },
          {
            label: "Interested",
            hasRemark: true,
            remarkRequired: false,
            order: 6,
          },
          {
            label: "Wrong Information",
            hasRemark: true,
            remarkRequired: true,
            order: 7,
          },
          {
            label: "Not Pickup",
            hasRemark: false,
            remarkRequired: false,
            order: 8,
          },
          { label: "Other", hasRemark: true, remarkRequired: true, order: 9 },
        ],
      });
    }

    return res.status(200).json({ success: true, data: config });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── ADD option ────────────────────────────────────────────────────────────────
export const addOption = async (req, res) => {
  try {
    const { label, hasRemark, remarkRequired, remarkPlaceholder } = req.body;

    if (!label?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Label is required" });
    }

    // ✅ FIXED — no module from params
    const config = await FollowUpConfig.findOne({ module: CONFIG_MODULE });
    if (!config) {
      return res
        .status(404)
        .json({ success: false, message: "Config not found" });
    }

    const maxOrder = config.options.reduce(
      (max, o) => Math.max(max, o.order),
      -1,
    );

    config.options.push({
      label: label.trim(),
      hasRemark: hasRemark ?? false,
      remarkRequired: remarkRequired ?? false,
      remarkPlaceholder: remarkPlaceholder || "Add a remark…",
      isActive: true,
      order: maxOrder + 1,
    });

    await config.save();

    return res.status(201).json({ success: true, data: config });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── UPDATE option ─────────────────────────────────────────────────────────────
export const updateOption = async (req, res) => {
  try {
    const { optionId } = req.params; // ✅ FIXED — removed module from params
    const { label, hasRemark, remarkRequired, remarkPlaceholder, isActive } =
      req.body;

    const config = await FollowUpConfig.findOne({ module: CONFIG_MODULE });
    if (!config) {
      return res
        .status(404)
        .json({ success: false, message: "Config not found" });
    }

    const option = config.options.id(optionId);
    if (!option) {
      return res
        .status(404)
        .json({ success: false, message: "Option not found" });
    }

    if (label !== undefined) option.label = label.trim();
    if (hasRemark !== undefined) option.hasRemark = hasRemark;
    if (remarkRequired !== undefined) option.remarkRequired = remarkRequired;
    if (remarkPlaceholder !== undefined)
      option.remarkPlaceholder = remarkPlaceholder;
    if (isActive !== undefined) option.isActive = isActive;
    if (hasRemark === false) option.remarkRequired = false;

    await config.save();

    return res.status(200).json({ success: true, data: config });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── DELETE option ─────────────────────────────────────────────────────────────
export const deleteOption = async (req, res) => {
  try {
    const { optionId } = req.params; // ✅ FIXED — removed module from params

    const config = await FollowUpConfig.findOne({ module: CONFIG_MODULE });
    if (!config) {
      return res
        .status(404)
        .json({ success: false, message: "Config not found" });
    }

    config.options = config.options.filter(
      (o) => o._id.toString() !== optionId,
    );
    await config.save();

    return res.status(200).json({ success: true, data: config });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── REORDER options ───────────────────────────────────────────────────────────
export const reorderOptions = async (req, res) => {
  try {
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds)) {
      return res
        .status(400)
        .json({ success: false, message: "orderedIds must be an array" });
    }

    // ✅ FIXED — removed module from params
    const config = await FollowUpConfig.findOne({ module: CONFIG_MODULE });
    if (!config) {
      return res
        .status(404)
        .json({ success: false, message: "Config not found" });
    }

    orderedIds.forEach((id, index) => {
      const option = config.options.id(id);
      if (option) option.order = index;
    });

    config.options.sort((a, b) => a.order - b.order);
    await config.save();

    return res.status(200).json({ success: true, data: config });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
