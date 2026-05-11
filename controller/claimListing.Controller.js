// controllers/claimController.js
import ClaimBusiness from "../model/claimBusinessSchema.js";
import { resolveListing } from "../utils/resolveListing.js";
import {
  sendClaimSubmittedMail,
  sendClaimReceivedAdminMail,
  sendClaimNoticeToOwnerMail,
} from "../utils/sendMail.js";
import User from "../model/userSchema.js";
import { errorData, successData } from "../services/helper.js";

// ─── POST /api/:type/:slug/claim ──────────────────────────────────────────────

// ─── submitClaim ──────────────────────────────────────────────────────────────
export const submitClaim = async (req, res) => {
  try {
    const { type, slug } = req.params;
    const { fullName, email, countryCode, mobileNumber, reasonForClaim } =
      req.body;

    if (!fullName || !email || !mobileNumber || !reasonForClaim)
      return res
        .status(422)
        .json({ success: false, message: "All fields are required" });

    const { listing, modelName } = await resolveListing(slug, type);

    if (listing.isClaimed)
      return res
        .status(400)
        .json({ success: false, message: "This listing is already claimed." });

    const existing = await ClaimBusiness.findOne({
      listingId: listing._id,
      status: "pending",
    });
    if (existing)
      return res.status(400).json({
        success: false,
        message: "A claim for this listing is already under review.",
      });

    const claim = await ClaimBusiness.create({
      listingId: listing._id,
      listingModel: modelName,
      listingSlug: listing.slug,
      claimedBy: req.user?._id,
      fullName,
      email,
      countryCode: countryCode || 971,
      mobileNumber,
      reasonForClaim,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // ── Send confirmation mail to claimant ────────────────────────────────
    // try {
    //   await sendClaimSubmittedMail(
    //     email,
    //     { fullName, email, countryCode, mobileNumber, reasonForClaim },
    //     listing.businessName || listing.slug,
    //   );
    //   console.log(`✅ Claim mail sent to ${email}`);
    // } catch (mailErr) {
    //   console.warn("❌ Claim mail failed:", mailErr.message);
    // }

    // ── Notify admin about the new claim ──────────────────────────────────
    // try {
    //   await sendClaimReceivedAdminMail(
    //     { fullName, email, countryCode, mobileNumber, reasonForClaim },
    //     listing.businessName || listing.slug,
    //     listing.slug,
    //   );
    //   console.log(`✅ Claim admin alert sent for: ${listing.slug}`);
    // } catch (adminMailErr) {
    //   console.warn("❌ Claim admin alert failed:", adminMailErr.message);
    // }

    // ── Notify Listing Owner about the claim ──────────────────────────────
    try {
      const owner = listing.createdBy
        ? await User.findById(listing.createdBy).select("email name").lean()
        : null;
      const ownerEmail = listing.email || owner?.email;
      const ownerName =
        listing.contactPersonName || owner?.name || listing.businessName;

      if (ownerEmail) {
        await sendClaimNoticeToOwnerMail(
          ownerEmail,
          ownerName,
          listing.businessName || listing.slug,
          fullName,
          reasonForClaim,
        );
        console.log(`✅ Claim notice sent to owner: ${ownerEmail}`);
      }
    } catch (ownerMailErr) {
      console.warn("❌ Claim owner notice failed:", ownerMailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Your claim has been submitted and is under review.",
      data: { id: claim._id },
    });
  } catch (err) {
    if (err.code === 11000)
      return res
        .status(400)
        .json({ success: false, message: "A pending claim already exists." });
    if (err.status)
      return res
        .status(err.status)
        .json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/:type/:slug/claim  (check status) ───────────────────────────────
export const getClaimStatus = async (req, res) => {
  try {
    const { type, slug } = req.params;
    const { listing } = await resolveListing(slug, type);

    const claim = await ClaimBusiness.findOne({ listingId: listing._id })
      .sort({ createdAt: -1 })
      .select("status createdAt");

    return res.json({
      success: true,
      data: {
        isClaimed: listing.isClaimed || false,
        claimStatus: claim?.status || null,
        claimId: claim?._id || null,
      },
    });
  } catch (err) {
    if (err.status)
      return res
        .status(err.status)
        .json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/my-claims ───────────────────────────────────────────────────────
export const getMyClaims = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user._id;

    const filter = {
      claimedBy: userId,
      isDeleted: false,
    };

    const [claims, total, stats] = await Promise.all([
      ClaimBusiness.find(filter)
        .populate("listingId", "businessName slug")
        .sort({ createdAt: -1 })
        .skip((+page - 1) * +limit)
        .limit(+limit)
        .lean(),

      ClaimBusiness.countDocuments(filter),

      ClaimBusiness.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const statistics = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    stats.forEach((s) => {
      statistics[s._id] = s.count;
      statistics.total += s.count;
    });

    const result = claims.map((c) => ({
      ...c,
      id: c._id,
      title: c.listingId?.businessName || c.listingSlug,
      name: c.fullName,
      email: c.email,
      phone: `${c.countryCode}${c.mobileNumber}`,
      message: c.reasonForClaim,
      status: c.status,
      created_at: new Date(c.createdAt).toLocaleDateString(),
    }));

    return successData(res, 200, true, "My claims fetched", {
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

// ─── GET /api/admin/claims  (admin panel list) ────────────────────────────────
export const adminListClaims = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, listingModel } = req.query;
    const filter = { isDeleted: false };
    if (status) filter.status = status;
    if (listingModel) filter.listingModel = listingModel;

    const [claims, total] = await Promise.all([
      ClaimBusiness.find(filter)
        .populate("claimedBy", "name email")
        .sort({ createdAt: -1 })
        .skip((+page - 1) * +limit)
        .limit(+limit),
      ClaimBusiness.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: claims,
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

// ─── PATCH /api/admin/claims/:claimId  (approve / reject) ────────────────────
export const adminReviewClaim = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    if (!["approved", "rejected"].includes(status))
      return res
        .status(422)
        .json({ success: false, message: "Invalid status" });

    const claim = await ClaimBusiness.findByIdAndUpdate(
      req.params.claimId,
      { status, adminNote, approvedBy: req.user?._id, reviewedAt: new Date() },
      { new: true },
    );

    if (!claim)
      return res
        .status(404)
        .json({ success: false, message: "Claim not found" });

    // If approved → mark the listing as claimed
    if (status === "approved") {
      const { model } =
        (await import("../utils/resolveListing.js")).MODEL_MAP[
          claim.listingModel
            .toLowerCase()
            .replace("businesslisting", "business")
        ] || {};
      if (model) {
        await model.findByIdAndUpdate(claim.listingId, {
          isClaimed: true,
          claimedBy: claim.claimedBy,
          isVerified: true,
        });
      }
    }

    return res.json({ success: true, data: claim });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
