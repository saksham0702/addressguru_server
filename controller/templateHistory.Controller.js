import TemplateHistory from "../model/templateHistorySchema.js";

/**
 * @desc    Create a new template history record
 * @route   POST /user/template/history/create
 * @access  Private
 */
export const createTemplateHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    console.log("req.body", req.body)

    const {
      template_id,
      type,
      msg,
      subject,
      label,
      recipient,
      leadId,
      leadName,
      leadPhone,
      leadEmail,
      listingId,
      listingName,
    } = req.body;

    if (!template_id || !type || !msg) {
      return res.status(400).json({
        success: false,
        message: "template_id, type, and msg are required",
      });
    }

    const history = await TemplateHistory.create({
      userId,
      templateId: template_id,
      type: String(type),
      msg,
      subject: subject || "",
      label: label || "",
      recipient: recipient || "",
      leadId: leadId || null,
      leadName: leadName || "",
      leadPhone: leadPhone || "",
      leadEmail: leadEmail || "",
      listingId: listingId || null,
      listingName: listingName || "",
    });

    return res.status(201).json({
      success: true,
      message: "Template history recorded successfully",
      result: history,
    });
  } catch (error) {
    console.error("createTemplateHistory Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Get all template history for the authenticated user
 * @route   GET /template/history
 * @access  Private
 */
export const getTemplateHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 20, type } = req.query;

    const filter = { userId };
    if (type) filter.type = String(type);

    const [history, total] = await Promise.all([
      TemplateHistory.find(filter)
        .populate("templateId", "title")
        .populate({
          path: "leadId",
          populate: { path: "listingId" }
        })
        .sort({ createdAt: -1 })
        .skip((+page - 1) * +limit)
        .limit(+limit)
        .lean(),
      TemplateHistory.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      result: history,
      total,
      pagination: {
        total,
        page: +page,
        limit: +limit,
        pages: Math.ceil(total / +limit),
      },
    });
  } catch (error) {
    console.error("getTemplateHistory Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
