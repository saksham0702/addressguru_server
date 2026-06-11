// controllers/reportController.js
import ReportAd, { REPORT_REASONS } from "../model/reportedListingSchema.js";
import { resolveListing, MODEL_MAP } from "../utils/resolveListing.js";
import {
  sendListingReportedMail,
  sendReportConfirmationMail,
  sendReportNoticeToOwnerMail,
} from "../utils/sendMail.js";
import User from "../model/userSchema.js";
import { errorData, successData } from "../services/helper.js";

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
      return res
        .status(422)
        .json({ success: false, message: "Reason is required" });
    if (!REPORT_REASONS.includes(reason))
      return res
        .status(422)
        .json({ success: false, message: "Invalid reason" });
    if (description && description.length > 500)
      return res
        .status(422)
        .json({ success: false, message: "Description max 500 chars" });

    const { listing, modelName } = await resolveListing(slug, type);

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const already = await ReportAd.findOne({
      listingId: listing._id,
      ipAddress: req.ip,
      createdAt: { $gte: oneDayAgo },
    });
    if (already)
      return res.status(429).json({
        success: false,
        message: "You have already reported this listing recently.",
      });

    await ReportAd.create({
      listingId: listing._id,
      listingModel: modelName,
      listingSlug: listing.slug,
      reportedBy: req.user?._id,
      reason,
      description,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Auto-flag after 5 pending reports
    const pendingCount = await ReportAd.countDocuments({
      listingId: listing._id,
      status: "pending",
    });
    let isFlagged = false;
    if (pendingCount >= 5) {
      await listing.constructor.findByIdAndUpdate(listing._id, {
        flagged: true,
      });
      isFlagged = true;
    }

    // ── Notify admin via email ─────────────────────────────────────────────
    // try {
    //    await sendListingReportedMail(
    //     null,
    //     { reason, description, ipAddress: req.ip },
    //     listing.title || listing.businessName || listing.slug,
    //     listing.slug,
    //     pendingCount,
    //     isFlagged,
    //   );
    //   console.log(`✅ Report mail sent to admin for: ${listing.slug}`);
    // } catch (mailErr) {
    //   console.warn("❌ Report mail failed:", mailErr.message);
    // }

    // ── Send confirmation mail to reporter ────────────────────────────────
    // try {
    //   const reporterEmail = req.user?.email; // Assumes req.user is populated by auth middleware
    //   if (reporterEmail) {
    //      await sendReportConfirmationMail(
    //       reporterEmail,
    //       listing.title || listing.businessName || listing.slug,
    //       reason
    //     );
    //     console.log(`✅ Report confirmation mail sent to: ${reporterEmail}`);
    //   }
    // } catch (repMailErr) {
    //   console.warn("❌ Report confirmation mail failed:", repMailErr.message);
    // }

    // ── Notify Listing Owner about the report ─────────────────────────────
    try {
      const owner = listing.createdBy
        ? await User.findById(listing.createdBy).select("email name").lean()
        : null;
      const ownerEmail = listing.email || owner?.email;
      const ownerName =
        listing.contactPersonName || owner?.name || listing.businessName;

      if (ownerEmail) {
        await sendReportNoticeToOwnerMail(
          ownerEmail,
          ownerName,
          listing.title || listing.businessName || listing.slug,
          listing.slug,
          reason,
        );
        console.log(`✅ Report notice sent to owner: ${ownerEmail}`);
      }
    } catch (ownerMailErr) {
      console.warn("❌ Report owner notice failed:", ownerMailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Thank you. Your report has been submitted.",
    });
  } catch (err) {
    if (err.status)
      return res
        .status(err.status)
        .json({ success: false, message: err.message });
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
      pagination: {
        total,
        page: +page,
        limit: +limit,
        pages: Math.ceil(total / +limit),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/my-reports
export const getMyReports = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user._id;

    const filter = {
      reportedBy: userId,
      isDeleted: false,
    };

    const [reports, total, stats] = await Promise.all([
      ReportAd.find(filter)
        .populate("listingId", "businessName slug")
        .sort({ createdAt: -1 })
        .skip((+page - 1) * +limit)
        .limit(+limit)
        .lean(),

      ReportAd.countDocuments(filter),

      ReportAd.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const statistics = {
      total: 0,
      pending: 0,
      reviewed: 0,
      dismissed: 0,
      action_taken: 0,
    };

    stats.forEach((s) => {
      statistics[s._id] = s.count;
      statistics.total += s.count;
    });

    const result = reports.map((r) => ({
      ...r,
      id: r._id,
      title: r.listingId?.title || r.listingId?.businessName || r.listingSlug,
      reason: r.reason,
      message: r.description,
      status: r.status,
      created_at: new Date(r.createdAt).toLocaleDateString(),
    }));

    return successData(res, 200, true, "My reports fetched", {
      listings: result,
      total,
      statistics,
      pagination: {
        total,
        page: +page,
        limit: +limit,
        pages: Math.ceil(total / +limit),
      },
    });
  } catch (err) {
    return errorData(res, 500, false, "Server error");
  }
};

// ─── PATCH /api/admin/reports/:reportId ──────────────────────────────────────
export const adminReviewReport = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const valid = ["reviewed", "dismissed", "action_taken"];
    if (!valid.includes(status))
      return res
        .status(422)
        .json({ success: false, message: "Invalid status" });

    const report = await ReportAd.findByIdAndUpdate(
      req.params.reportId,
      { status, adminNote, approvedBy: req.user?._id, reviewedAt: new Date() },
      { new: true },
    );

    if (!report)
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });
    return res.json({ success: true, data: report });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
