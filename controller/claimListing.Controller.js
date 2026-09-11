// controllers/claimController.js
import ClaimBusiness from "../model/claimBusinessSchema.js";
import { resolveListing } from "../utils/resolveListing.js";
import {
  sendClaimSubmittedMail,
  sendClaimApprovedMail,
  sendClaimReceivedAdminMail,
  sendClaimNoticeToOwnerMail,
} from "../utils/sendMail.js";
import User from "../model/userSchema.js";
import BusinessListing from "../model/businessListingSchema.js";
import { errorData, successData } from "../services/helper.js";
import { sendTextMessage } from "../modules/whatsapp/services/whatsappMessage.js";

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
        message:
          "This listing has already been claimed and verified by an owner.",
      });
    }

    const existing = await ClaimBusiness.findOne({
      listingId: listing._id,
      status: "pending",
    });

    if (existing) {
      if (existing.email === email || req.user?.email === email) {
        return res.status(400).json({
          success: false,
          message:
            "You have already submitted a claim for this listing. It is currently under review.",
        });
      }
      return res.status(400).json({
        success: false,
        message:
          "A claim for this listing is already under review from another user. No new claims are accepted at this time.",
      });
    }

    const businessName =
      listing.businessName || listing.title || listing.name || listing.slug;

    const claim = await ClaimBusiness.create({
      listingId: listing._id,
      listingModel: modelName,
      listingSlug: listing.slug,
      claimedBy: existingUser._id, // ✅ use resolved user
      fullName: existingUser.name || fullName, // ✅ prevent fake name override
      email,
      countryCode: String(countryCode || "971").replace(/^\+/, ""),
      mobileNumber,
      idProofImage,
      reasonForClaim,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // ✅ 1. Send Automated 2-Step Verification WhatsApp Message to Claimant
    try {
      const waText = `Hello *${existingUser.name || fullName}*, 👋\n\nThank you for claiming your business listing *${businessName}* on AddressGuru UAE.\n\nBefore we transfer the listing ownership to your account, we require a simple 2-step verification for security purposes.\n\nYou can complete the verification using either one of the following options:\n\n*Option 1 – Email Verification*\nSend us an email from the email address currently associated with the business listing.\n\n*Option 2 – WhatsApp Verification*\nSend us a WhatsApp message from the phone number currently registered on the business listing.\n\nOnce we receive and verify either one, we will complete the ownership transfer of your business listing to your account.\n\nThank you for your cooperation and for helping us keep business listings secure.\n\nBest regards,\n*AddressGuru UAE Team*`;

      await sendTextMessage({
        to: String(mobileNumber),
        text: waText,
        countryCode: String(countryCode || "971"),
      });
      console.log(
        `✅ WhatsApp claim 2-step verification message sent to ${mobileNumber}`,
      );
    } catch (waErr) {
      console.warn(
        "⚠️ WhatsApp claim submission notification failed:",
        waErr.message,
      );
    }

    // ✅ 2. Send Claim Confirmation Email to Claimant
    try {
      await sendClaimSubmittedMail(email, claim, businessName);
      console.log(`✅ Claim submitted email sent to ${email}`);
    } catch (mailErr) {
      console.warn("⚠️ Claimant submission email failed:", mailErr.message);
    }

    // ✅ 3. Owner mail notice (if listing had a previous owner)
    try {
      const owner = listing.createdBy
        ? await User.findById(listing.createdBy).select("email name").lean()
        : null;

      const ownerEmail = listing.email || owner?.email;
      const ownerName =
        listing.contactPersonName || owner?.name || businessName;

      if (ownerEmail) {
        await sendClaimNoticeToOwnerMail(
          ownerEmail,
          ownerName,
          businessName,
          fullName,
          reasonForClaim,
        );
      }
    } catch (err) {
      console.warn("Owner mail failed:", err.message);
    }

    return res.status(201).json({
      success: true,
      message:
        "Your claim has been submitted and is under review. Please check your WhatsApp and email for verification instructions.",
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
        .populate("listingId", "businessName title name slug")
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

// ─── POST /api/admin/claims/:claimId/send-message (Send verification/custom message) ──
export const sendClaimCustomMessage = async (req, res) => {
  try {
    const { claimId } = req.params;
    const {
      sendWhatsapp = true,
      whatsappMessage,
      whatsappPhone,
      whatsappCountryCode,
      sendEmail = true,
    } = req.body;

    const claim = await ClaimBusiness.findById(claimId)
      .populate("listingId", "businessName title name slug")
      .lean();

    if (!claim) {
      return res
        .status(404)
        .json({ success: false, message: "Claim not found" });
    }

    const businessName =
      claim.listingId?.businessName ||
      claim.listingId?.title ||
      claim.listingId?.name ||
      claim.listingSlug;

    let waSent = false;
    if (sendWhatsapp) {
      const phone = String(whatsappPhone || claim.mobileNumber);
      const countryCode = String(
        whatsappCountryCode || claim.countryCode || "971",
      );
      const text =
        whatsappMessage ||
        `Hello *${claim.fullName || "User"}*, 👋\n\nThank you for claiming your business listing *${businessName}* on AddressGuru UAE.\n\nBefore we transfer the listing ownership to your account, we require a simple 2-step verification for security purposes.\n\nYou can complete the verification using either one of the following options:\n\n*Option 1 – Email Verification*\nSend us an email from the email address currently associated with the business listing.\n\n*Option 2 – WhatsApp Verification*\nSend us a WhatsApp message from the phone number currently registered on the business listing.\n\nOnce we receive and verify either one, we will complete the ownership transfer of your business listing to your account.\n\nThank you for your cooperation and for helping us keep business listings secure.\n\nBest regards,\n*AddressGuru UAE Team*`;

      if (phone) {
        await sendTextMessage({ to: phone, text, countryCode });
        waSent = true;
      }
    }

    return res.json({
      success: true,
      message: waSent
        ? "Verification message sent successfully to claimant via WhatsApp."
        : "Message processed successfully.",
    });
  } catch (err) {
    console.error("sendClaimCustomMessage error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: err.message,
    });
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
    ).populate("listingId", "businessName title name slug");

    if (!claim)
      return res
        .status(404)
        .json({ success: false, message: "Claim not found" });

    const businessName =
      claim.listingId?.businessName ||
      claim.listingId?.title ||
      claim.listingId?.name ||
      claim.listingSlug;

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
          createdBy: claim.claimedBy, // Update the actual owner
          isClaimed: true,
          claimedBy: claim.claimedBy,
          isVerified: true,
        });
      }

      // Send Claim Approved Email
      if (req.body.sendEmail !== false) {
        try {
          const listingUrl = `https://addressguru.ae/${claim.listingSlug}`;
          await sendClaimApprovedMail(
            claim.email,
            claim.fullName,
            businessName,
            listingUrl,
            "https://addressguru.ae/dashboard",
          );
        } catch (mailErr) {
          console.warn("⚠️ Claim approved email failed:", mailErr.message);
        }
      }
    }

    // Optional WhatsApp message on claim review
    if (req.body.sendWhatsapp || req.body.whatsappMessage) {
      try {
        const phone = req.body.whatsappPhone || claim.mobileNumber;
        const countryCode =
          req.body.whatsappCountryCode || claim.countryCode || "971";
        const text =
          req.body.whatsappMessage ||
          (status === "approved"
            ? `Hello *${claim.fullName || "User"}*, 🎉 Great news! Your ownership claim for *${businessName}* has been approved on AddressGuru UAE. You can now manage your listing from your dashboard: https://addressguru.ae/dashboard`
            : `Hello *${claim.fullName || "User"}*, We reviewed your ownership claim for *${businessName}* on AddressGuru UAE. Unfortunately, your claim was not approved at this time.${adminNote ? `\n\nReason: ${adminNote}` : ""}`);

        if (phone) {
          await sendTextMessage({ to: phone, text, countryCode });
          console.log(`✅ WhatsApp claim ${status} message sent to ${phone}`);
        }
      } catch (waErr) {
        console.warn("⚠️ WhatsApp claim message failed:", waErr.message);
      }
    }

    return res.json({ success: true, data: claim });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── PATCH /api/admin/claims/:claimId/transfer ───────────────────────────────
export const transferOwnership = async (req, res) => {
  try {
    const { claimId } = req.params;
    const claim = await ClaimBusiness.findById(claimId).lean();

    if (!claim) {
      return res
        .status(404)
        .json({ success: false, message: "Claim not found" });
    }

    const modelKey = claim.listingModel
      .toLowerCase()
      .replace("businesslisting", "business");

    const resolveModule = await import("../utils/resolveListing.js");

    const { model } = resolveModule.MODEL_MAP[modelKey] || {};

    if (!model) {
      return res.status(400).json({
        success: false,
        message: `Ownership transfer is not supported for "${claim.listingModel}".`,
      });
    }

    let targetUserId = claim.claimedBy ?? null;

    if (!targetUserId) {
      const user = await User.findOne({
        email: claim.email,
        isDeleted: false,
      }).lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: `No registered account found for "${claim.email}".`,
        });
      }
      targetUserId = user._id;
    }

    const updatedListing = await model.findByIdAndUpdate(
      claim.listingId,
      {
        $set: {
          createdBy: targetUserId,
          isClaimed: true,
          claimedBy: targetUserId,
          isVerified: true,
        },
      },
      { new: true },
    );

    if (!updatedListing) {
      return res
        .status(404)
        .json({ success: false, message: "Listing not found" });
    }

    await ClaimBusiness.findByIdAndUpdate(claimId, {
      status: "approved",
      claimedBy: targetUserId,
      approvedBy: req.user?._id,
      reviewedAt: new Date(),
      adminNote: req.body.adminNote || "Ownership transferred by admin",
    });

    const businessName =
      updatedListing.businessName ||
      updatedListing.title ||
      updatedListing.name ||
      claim.listingSlug;

    const listingUrl = `https://addressguru.ae/${updatedListing.slug || claim.listingSlug}`;
    const dashboardUrl = "https://addressguru.ae/dashboard";

    // ── 1. Send Claim Approved Email to Claimant ──
    if (req.body.sendEmail !== false) {
      try {
        await sendClaimApprovedMail(
          claim.email,
          claim.fullName,
          businessName,
          listingUrl,
          dashboardUrl,
        );
        console.log(`✅ Claim approved email sent to ${claim.email}`);
      } catch (emailErr) {
        console.warn("⚠️ Claim approved email failed:", emailErr.message);
      }
    }

    // ── 2. Send WhatsApp Message on Transfer ──
    const shouldSendWhatsapp =
      req.body.sendWhatsapp !== false &&
      (req.body.sendWhatsapp === true || req.body.whatsappMessage);

    if (shouldSendWhatsapp) {
      try {
        const phone = req.body.whatsappPhone || claim.mobileNumber;
        const countryCode =
          req.body.whatsappCountryCode || claim.countryCode || "971";
        const text =
          req.body.whatsappMessage ||
          `Hello *${claim.fullName || "User"}*, 🎉 Great news! We have verified and transferred the ownership of *${businessName}* to you on AddressGuru UAE.\n\nYou now have full owner access to manage details and view customer enquiries:\n👉 ${dashboardUrl}\n\nThank you for choosing AddressGuru UAE!`;

        if (phone) {
          await sendTextMessage({ to: phone, text, countryCode });
          console.log(
            `✅ WhatsApp ownership transfer message sent to ${phone}`,
          );
        }
      } catch (waErr) {
        console.warn(
          "⚠️ WhatsApp ownership transfer notification failed:",
          waErr.message,
        );
      }
    }

    return res.json({
      success: true,
      message: `Ownership of "${businessName}" transferred successfully.`,
      data: {
        listingId: updatedListing._id,
        newOwnerId: targetUserId,
        businessName,
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};
