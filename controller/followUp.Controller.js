import FollowUp from "../model/followUpSchema.js";
import FollowUpConfig from "../model/followUpConfigSchema.js";

// ── CREATE a follow-up log ────────────────────────────────────────────────────
// POST /api/followups
// Body: { listingId, activityOptionId, remark, nextFollowUpDate }
export const createFollowUp = async (req, res) => {
  try {
    const { listingId, activityOptionId, remark, nextFollowUpDate } = req.body;
    const createdBy = req.user._id; // comes from your auth middleware

    // ── Validate required fields ────────────────────────────────────────────
    if (!listingId || !activityOptionId) {
      return res.status(400).json({
        success: false,
        message: "listingId and activityOptionId are required",
      });
    }

    // ── Fetch the option from config to validate + get label ────────────────
    const config = await FollowUpConfig.findOne({ module: "listing" });
    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Follow-up config not found",
      });
    }

    const option = config.options.id(activityOptionId);
    if (!option || !option.isActive) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive activity option",
      });
    }

    // ── Validate remark if required ─────────────────────────────────────────
    if (option.remarkRequired && !remark?.trim()) {
      return res.status(400).json({
        success: false,
        message: `Remark is required for "${option.label}"`,
      });
    }

    // ── Create the log ──────────────────────────────────────────────────────
    const followUp = await FollowUp.create({
      listing: listingId,
      activityOptionId,
      reason: option.label, // snapshot the label
      remark: option.hasRemark ? remark?.trim() : null,
      nextFollowUpDate: nextFollowUpDate || null,
      createdBy,
      module: "listing",
    });

    // Populate createdBy for response
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

// ── GET all follow-ups for a listing ─────────────────────────────────────────
// GET /api/followups/listing/:listingId
export const getFollowUpsByListing = async (req, res) => {
  try {
    const { listingId } = req.params;

    const followUps = await FollowUp.find({ listing: listingId })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 }); // newest first

    return res.status(200).json({
      success: true,
      message: "Follow-ups fetched successfully",
      count: followUps.length,
      data: followUps,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET single follow-up detail ───────────────────────────────────────────────
// GET /api/followups/:id
export const getFollowUpById = async (req, res) => {
  try {
    const followUp = await FollowUp.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("listing", "businessName");

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

// ── DELETE a follow-up log (admin only) ───────────────────────────────────────
// DELETE /api/followups/:id soft delete
export const deleteFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.findByIdAndUpdate(req.params.id, {
      isDeleted: true,
    });

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

// ── GET config for a module (used by modal to load options) ──────────────────
// GET /api/followup-config/:module
export const getConfig = async (req, res) => {
  try {
    const { module } = req.params;

    let config = await FollowUpConfig.findOne({ module });

    // If no config exists yet, seed defaults for "listing"
    if (!config) {
      config = await FollowUpConfig.create({
        module,
        options: [
          { label: "Call Back Later",        hasRemark: false, remarkRequired: false, order: 0 },
          { label: "Call Me Tomorrow",        hasRemark: false, remarkRequired: false, order: 1 },
          { label: "Payment Tomorrow",        hasRemark: true,  remarkRequired: false, order: 2 },
          { label: "Talk With My Partner",    hasRemark: false, remarkRequired: false, order: 3 },
          { label: "Work With Other Company", hasRemark: true,  remarkRequired: true,  order: 4 },
          { label: "Not Interested",          hasRemark: true,  remarkRequired: true,  order: 5 },
          { label: "Interested",              hasRemark: true,  remarkRequired: false, order: 6 },
          { label: "Wrong Information",       hasRemark: true,  remarkRequired: true,  order: 7 },
          { label: "Not Pickup",              hasRemark: false, remarkRequired: false, order: 8 },
          { label: "Other",                   hasRemark: true,  remarkRequired: true,  order: 9 },
        ],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Config fetched successfully",
      data: config,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── ADD a new option ─────────────────────────────────────────────────────────
// POST /api/followup-config/:module/option
export const addOption = async (req, res) => {
  try {
    const { module } = req.params;
    const { label, hasRemark, remarkRequired, remarkPlaceholder } = req.body;

    if (!label?.trim()) {
      return res.status(400).json({ success: false, message: "Label is required" });
    }

    const config = await FollowUpConfig.findOne({ module });
    if (!config) {
      return res.status(404).json({ success: false, message: "Config not found" });
    }

    const maxOrder = config.options.reduce((max, o) => Math.max(max, o.order), -1);

    config.options.push({
      label: label.trim(),
      hasRemark: hasRemark ?? false,
      remarkRequired: remarkRequired ?? false,
      remarkPlaceholder: remarkPlaceholder || "Add a remark…",
      isActive: true,
      order: maxOrder + 1,
    });

    await config.save();

    return res.status(201).json({
      success: true,
      message: "Option added successfully",
      data: config,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── UPDATE an option (toggle remark, rename, etc.) ───────────────────────────
// PUT /api/followup-config/:module/option/:optionId
export const updateOption = async (req, res) => {
  try {
    const { module, optionId } = req.params;
    const { label, hasRemark, remarkRequired, remarkPlaceholder, isActive } = req.body;

    const config = await FollowUpConfig.findOne({ module });
    if (!config) {
      return res.status(404).json({ success: false, message: "Config not found" });
    }

    const option = config.options.id(optionId);
    if (!option) {
      return res.status(404).json({ success: false, message: "Option not found" });
    }

    if (label !== undefined)             option.label             = label.trim();
    if (hasRemark !== undefined)         option.hasRemark         = hasRemark;
    if (remarkRequired !== undefined)    option.remarkRequired    = remarkRequired;
    if (remarkPlaceholder !== undefined) option.remarkPlaceholder = remarkPlaceholder;
    if (isActive !== undefined)          option.isActive          = isActive;

    // If remark is turned off, also turn off remarkRequired
    if (hasRemark === false) option.remarkRequired = false;

    await config.save();

    return res.status(200).json({
      success: true,
      message: "Option updated successfully",
      data: config,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── DELETE an option ─────────────────────────────────────────────────────────
// DELETE /api/followup-config/:module/option/:optionId
export const deleteOption = async (req, res) => {
  try {
    const { module, optionId } = req.params;

    const config = await FollowUpConfig.findOne({ module });
    if (!config) {
      return res.status(404).json({ success: false, message: "Config not found" });
    }

    config.options = config.options.filter(
      (o) => o._id.toString() !== optionId
    );

    await config.save();

    return res.status(200).json({
      success: true,
      message: "Option deleted successfully",
      data: config,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── REORDER options ──────────────────────────────────────────────────────────
// PUT /api/followup-config/:module/reorder
// body: { orderedIds: ["id1", "id2", "id3", ...] }
export const reorderOptions = async (req, res) => {
  try {
    const { module } = req.params;
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ success: false, message: "orderedIds must be an array" });
    }

    const config = await FollowUpConfig.findOne({ module });
    if (!config) {
      return res.status(404).json({ success: false, message: "Config not found" });
    }

    orderedIds.forEach((id, index) => {
      const option = config.options.id(id);
      if (option) option.order = index;
    });

    config.options.sort((a, b) => a.order - b.order);
    await config.save();

    return res.status(200).json({
      success: true,
      message: "Options reordered successfully",
      data: config,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
