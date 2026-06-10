// controllers/claimController.js
import ClaimBusiness from "../model/claimBusinessSchema.js";
import { resolveListing } from "../utils/resolveListing.js";
import {
  sendClaimSubmittedMail,
  sendClaimReceivedAdminMail,
  sendClaimNoticeToOwnerMail,
} from "../utils/sendMail.js";
import User from "../model/userSchema.js";
import BusinessListing from "../model/businessListingSchema.js";
import { errorData, successData } from "../services/helper.js";

// ─── POST /api/:type/:slug/claim ──────────────────────────────────────────────

// ─── submitClaim ──────────────────────────────────────────────────────────────
export const submitClaim = async (req, res) => {
  try {
    const { type, slug } = req.params;
    const { fullName, email, countryCode, mobileNumber, reasonForClaim } =
      req.body;

    if (!fullName || !email || !mobileNumber || !reasonForClaim) {
      return res.status(422).json({
        success: false,
        message: "All fields are required",
      });
    }

    // ✅ CHECK: User must be registered
    const existingUser = await User.findOne({ email })
      .select("_id name email")
      .lean();

    if (!existingUser) {
      return res.status(401).json({
        success: false,
        message: "Please register first to submit a claim.",
      });
    }

    // ✅ Handle uploaded file
    const idProofImage = req.file?.path;
    if (!idProofImage) {
      return res.status(422).json({
        success: false,
        message: "ID proof image is required",
      });
    }

    const { listing, modelName } = await resolveListing(slug, type);

    if (listing.isClaimed) {
      return res.status(400).json({
        success: false,
        message: "This listing is already claimed.",
      });
    }

    const existing = await ClaimBusiness.findOne({
      listingId: listing._id,
      status: "pending",
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A claim for this listing is already under review.",
      });
    }

    const claim = await ClaimBusiness.create({
      listingId: listing._id,
      listingModel: modelName,
      listingSlug: listing.slug,
      claimedBy: existingUser._id, // ✅ use resolved user
      fullName: existingUser.name || fullName, // ✅ prevent fake name override
      email,
      countryCode: countryCode || 91,
      mobileNumber,
      idProofImage,
      reasonForClaim,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Owner mail logic (unchanged)
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
      }
    } catch (err) {
      console.warn("Owner mail failed:", err.message);
    }

    return res.status(201).json({
      success: true,
      message: "Your claim has been submitted and is under review.",
      data: { id: claim._id },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A pending claim already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
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

// ─── PATCH /api/admin/claims/:claimId/transfer  (admin: transfer ownership) ───
export const transferOwnership = async (req, res) => {
  try {
    const { claimId } = req.params;

    const claim = await ClaimBusiness.findById(claimId).lean();
    if (!claim) {
      return res.status(404).json({ success: false, message: "Claim not found" });
    }

    // Find the user by the email on the claim
    const user = await User.findOne({ email: claim.email }).select("_id").lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No registered user found for this claim's email.",
      });
    }

    // Only BusinessListing supports ownership transfer for now
    if (claim.listingModel !== "BusinessListing") {
      return res.status(400).json({
        success: false,
        message: "Ownership transfer is only supported for Business Listings.",
      });
    }

    // Update the listing's owner
    const updatedListing = await BusinessListing.findByIdAndUpdate(
      claim.listingId,
      {
        createdBy: user._id,
        isClaimed: true,
        claimedBy: user._id,
        isVerified: true,
      },
      { new: true }
    ).select("_id businessName createdBy");

    if (!updatedListing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    // Also mark the claim as approved
    await ClaimBusiness.findByIdAndUpdate(claimId, {
      status: "approved",
      approvedBy: req.user?._id,
      reviewedAt: new Date(),
      adminNote: "Ownership transferred by admin",
    });

    return res.json({
      success: true,
      message: `Ownership of "${updatedListing.businessName}" successfully transferred to ${claim.email}.`,
      data: { listingId: updatedListing._id, newOwnerId: user._id },
    });
  } catch (err) {
    console.error("transferOwnership Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
