// controllers/claimController.js
import ClaimBusiness  from "../model/claimBusinessSchema.js";
import { resolveListing } from "../utils/resolveListing.js";

// ─── POST /api/:type/:slug/claim ──────────────────────────────────────────────
export const submitClaim = async (req, res) => {
  try {
    const { type, slug } = req.params;
    const { fullName, email, countryCode, mobileNumber, reasonForClaim } = req.body;

    if (!fullName || !email || !mobileNumber || !reasonForClaim)
      return res.status(422).json({ success: false, message: "All fields are required" });

    const { listing, modelName } = await resolveListing(slug, type);

    // Already claimed?
    if (listing.isClaimed)
      return res.status(400).json({ success: false, message: "This listing is already claimed." });

    // Existing pending claim?
    const existing = await ClaimBusiness.findOne({ listingId: listing._id, status: "pending" });
    if (existing)
      return res.status(400).json({ success: false, message: "A claim for this listing is already under review." });

    const claim = await ClaimBusiness.create({
      listingId:      listing._id,
      listingModel:   modelName,
      listingSlug:    listing.slug,
      claimedBy:      req.user?._id,
      fullName,
      email,
      countryCode:    countryCode || 91,
      mobileNumber,
      reasonForClaim,
      ipAddress:      req.ip,
      userAgent:      req.headers["user-agent"],
    });

    // TODO: notify admin

    return res.status(201).json({
      success: true,
      message: "Your claim has been submitted and is under review.",
      data: { id: claim._id },
    });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success: false, message: "A pending claim already exists." });
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
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
        isClaimed:   listing.isClaimed || false,
        claimStatus: claim?.status || null,
        claimId:     claim?._id || null,
      },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
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
      pagination: { total, page: +page, limit: +limit, pages: Math.ceil(total / +limit) },
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
      return res.status(422).json({ success: false, message: "Invalid status" });

    const claim = await ClaimBusiness.findByIdAndUpdate(
      req.params.claimId,
      { status, adminNote, approvedBy: req.user?._id, reviewedAt: new Date() },
      { new: true }
    );

    if (!claim) return res.status(404).json({ success: false, message: "Claim not found" });

    // If approved → mark the listing as claimed
    if (status === "approved") {
      const { model } = (await import("../utils/resolveListing.js")).MODEL_MAP[
        claim.listingModel.toLowerCase().replace("businesslisting", "business")
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