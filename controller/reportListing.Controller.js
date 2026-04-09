// controllers/reportController.js
import ReportAd, { REPORT_REASONS } from "../model/reportedListingSchema.js";
import { resolveListing, MODEL_MAP } from "../utils/resolveListing.js";
import { sendListingReportedMail } from "../utils/sendMail.js";


// ─── GET /api/report-reasons  (used by frontend radio list) ──────────────────
export const getReportReasons = (_req, res) => {
  return res.json({ success: true, data: REPORT_REASONS });
};

// ─── POST /api/:type/:slug/report ─────────────────────────────────────────────
export const submitReport = async (req, res) => {
  try {
    const { type, slug } = req.params;
    const { reason, description } = req.body;
 
    if (!reason)
      return res.status(422).json({ success: false, message: "Reason is required" });
    if (!REPORT_REASONS.includes(reason))
      return res.status(422).json({ success: false, message: "Invalid reason" });
    if (description && description.length > 500)
      return res.status(422).json({ success: false, message: "Description max 500 chars" });
 
    const { listing, modelName } = await resolveListing(slug, type);
 
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const already = await ReportAd.findOne({
      listingId: listing._id,
      ipAddress:  req.ip,
      createdAt:  { $gte: oneDayAgo },
    });
    if (already)
      return res.status(429).json({ success: false, message: "You have already reported this listing recently." });
 
    await ReportAd.create({
      listingId:    listing._id,
      listingModel: modelName,
      listingSlug:  listing.slug,
      reportedBy:   req.user?._id,
      reason,
      description,
      ipAddress:    req.ip,
      userAgent:    req.headers["user-agent"],
    });
 
    // Auto-flag after 5 pending reports
    const pendingCount = await ReportAd.countDocuments({ listingId: listing._id, status: "pending" });
    let isFlagged = false;
    if (pendingCount >= 5) {
      await listing.constructor.findByIdAndUpdate(listing._id, { flagged: true });
      isFlagged = true;
    }
 
    // ── Notify admin via email ─────────────────────────────────────────────
    try {
      await sendListingReportedMail(
        { reason, description, ipAddress: req.ip },
        listing.businessName || listing.slug,
        listing.slug,
        pendingCount,
        isFlagged,
      );
      console.log(`✅ Report mail sent to admin for: ${listing.slug}`);
    } catch (mailErr) {
      console.warn("❌ Report mail failed:", mailErr.message);
    }
 
    return res.status(201).json({ success: true, message: "Thank you. Your report has been submitted." });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/admin/reports ───────────────────────────────────────────────────
export const adminListReports = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, listingModel } = req.query;
    const filter = { isDeleted: false };
    if (status) filter.status = status;
    if (listingModel) filter.listingModel = listingModel;

    const [reports, total] = await Promise.all([
      ReportAd.find(filter)
        .populate("reportedBy", "name email")
        .sort({ createdAt: -1 })
        .skip((+page - 1) * +limit)
        .limit(+limit),
      ReportAd.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: reports,
      pagination: { total, page: +page, limit: +limit, pages: Math.ceil(total / +limit) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── PATCH /api/admin/reports/:reportId ──────────────────────────────────────
export const adminReviewReport = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const valid = ["reviewed", "dismissed", "action_taken"];
    if (!valid.includes(status))
      return res.status(422).json({ success: false, message: "Invalid status" });

    const report = await ReportAd.findByIdAndUpdate(
      req.params.reportId,
      { status, adminNote, approvedBy: req.user?._id, reviewedAt: new Date() },
      { new: true }
    );

    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    return res.json({ success: true, data: report });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};