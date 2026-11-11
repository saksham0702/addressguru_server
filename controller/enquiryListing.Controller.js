import Enquiry from "../model/listingEnquirySchema.js";
import User from "../model/userSchema.js";
import ListingStats from "../model/listingStatsSchema.js";
import Category from "../model/categoriesSchema.js";
import BusinessListing from "../model/businessListingSchema.js";
import Job from "../model/jobsListingSchema.js";
import PropertyListing from "../model/propertiesListingSchema.js";
import MarketplaceListing from "../model/marketplaceListingSchema.js";
import Plan from "../model/plansSchema.js";
import { resolveListing, MODEL_MAP } from "../utils/resolveListing.js";
import {
  sendEnquiryReceivedMail,
  sendEnquiryConfirmationMail,
} from "../utils/sendMail.js";

const normalizeCategory = (cat) => {
  const c = cat?.toLowerCase();
  if (c === "business") return "business";
  if (c === "job" || c === "jobs") return "job";
  if (c === "market" || c === "marketplace") return "marketplace";
  if (c === "property" || c === "properties") return "property";
  return c;
};

// ─── POST /api/:type/:slug/enquiry ────────────────────────────────────────────
// type = business | job | property | marketplace
export const sendEnquiry = async (req, res) => {
  try {
    const { type, slug } = req.params;
    const { fullName, email, countryCode, mobileNumber, message } = req.body;

    if (!fullName || !email || !mobileNumber)
      return res.status(422).json({
        success: false,
        message: "fullName, email and mobileNumber are required",
      });

    const typeNormalized = normalizeCategory(type);
    const { listing, modelName } = await resolveListing(slug, typeNormalized);

    const cleanCc = (countryCode || "").toString().trim();
    const formattedCountryCode = cleanCc
      ? (cleanCc.startsWith("+") ? cleanCc : `+${cleanCc.replace(/\D/g, "")}`)
      : "+971";

    const enquiry = await Enquiry.create({
      listingId: listing._id,
      listingModel: modelName,
      listingSlug: listing.slug,
      listingOwner: listing.createdBy,
      fullName,
      email,
      countryCode: formattedCountryCode,
      mobileNumber,
      message,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await ListingStats.create({
      listingId: listing._id,
      listingModel: modelName,
      type: "lead",
      userId: req.user?.id || null,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    if (listing.createdBy) {
      await User.findByIdAndUpdate(listing.createdBy, {
        $inc: { statistics_totalLeads: 1 },
      });
    }

    try {
      await listing.constructor.findByIdAndUpdate(listing._id, {
        $inc: { "stats.enquiries": 1 },
      });
    } catch (e) {}

    // ── Send mail to listing owner ─────────────────────────────────────────
    try {
      // Populate owner email if not directly on listing
      const owner = listing.createdBy
        ? await User.findById(listing.createdBy).select("email name").lean()
        : null;

      const ownerEmail = listing.email || owner?.email;
      const ownerName =
        listing.contactPersonName ||
        owner?.name ||
        listing.businessName ||
        listing.title ||
        listing.name ||
        "Valued Partner";
      const listingTitle =
        listing.businessName || listing.title || listing.name || listing.slug;

      if (ownerEmail) {
        // A listing is considered claimed if it has a createdBy user
        const isClaimed = !!listing.createdBy;

        await sendEnquiryReceivedMail(
          ownerEmail,
          ownerName,
          listingTitle,
          listing.slug,
          {
            fullName,
            email,
            countryCode: formattedCountryCode,
            mobileNumber,
            message,
          },
          isClaimed,
        );
        console.log(`✅ Enquiry mail sent to owner: ${ownerEmail}`);
      }
    } catch (mailErr) {
      console.warn("❌ Enquiry mail failed:", mailErr.message);
    }

    // ── Send mail to enquirer ──────────────────────────────────────────────

    return res.status(201).json({
      success: true,
      message: "Your enquiry has been sent successfully.",
      data: { id: enquiry._id },
    });
  } catch (err) {
    if (err.status)
      return res
        .status(err.status)
        .json({ success: false, message: err.message });
    console.warn("sendEnquiry:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Helper to determine whether a listing is on an active paid plan ────────────
export const checkIsListingPaid = (listing) => {
  if (!listing) return false;
  // If planStatus is expired or expiry date is past, unpaid
  if (listing.planStatus === "expired") return false;
  if (listing.planExpiryDate && new Date(listing.planExpiryDate) < new Date()) {
    return false;
  }
  // Admin assigned or role free = paid
  if (
    listing.planStatus === "admin_assigned" ||
    listing.planStatus === "role_free"
  ) {
    return true;
  }
  // Active plan
  if (listing.planStatus === "active") {
    if (listing.paymentStatus === "paid") return true;
    if (listing.plan && typeof listing.plan === "object" && listing.plan.price > 0) return true;
  }
  // If paymentStatus is explicitly 'paid'
  if (listing.paymentStatus === "paid") return true;
  return false;
};

const maskLeadEmail = (email) => {
  if (!email) return "•••••@•••••.com";
  const parts = email.split("@");
  if (parts.length < 2) return "•••••@•••••.com";
  const user = parts[0];
  const domain = parts[1];
  const maskedUser = user.length > 2 ? `${user.slice(0, 2)}••••` : "••••";
  return `${maskedUser}@${domain}`;
};

const maskLeadPhone = (phoneNum) => {
  if (!phoneNum) return "••••••••••";
  const str = String(phoneNum).trim();
  if (str.length <= 4) return "••••";
  return `${str.slice(0, 2)}••••••${str.slice(-2)}`;
};

/**
 * ─── GET /api/listing-features/my-leads  (Owner leads Dashboard) ──────────────
 * Used by owner dashboard to show all enquiries for current user
 */
export const getMyLeads = async (req, res) => {
  try {
    const { category, listingId, page = 1, limit = 50 } = req.query;

    const filter = {
      listingOwner: req.user.id,
      isDeleted: false,
    };

    if (category && category !== "all" && category !== "All") {
      const type = normalizeCategory(category);
      const entry = MODEL_MAP[type];
      if (entry) {
        filter.listingModel = entry.modelName;
      }
    }

    if (listingId && listingId !== "" && listingId !== "All") {
      filter.listingId = listingId;
    }

    const [enquiries, total] = await Promise.all([
      Enquiry.find(filter)
        .populate({
          path: "listingId",
          select:
            "businessName title name slug plan paymentStatus planStatus planExpiryDate company",
          populate: {
            path: "plan",
            select: "name price planCode durationInDays",
          },
        })
        .sort({ createdAt: -1 })
        .skip((+page - 1) * +limit)
        .limit(+limit)
        .lean(),
      Enquiry.countDocuments(filter),
    ]);

    // Check if current user is admin or editor
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const isAdminOrEditor =
      userRoles.some((r) => r === 1 || r === 2 || r === "1" || r === "2" || r === "admin" || r === "editor") ||
      ["admin", "editor"].includes(String(req.user?.role || "").toLowerCase());

    // Track free leads count per listing (free listings unlock first 7 leads, then ask to pay/upgrade)
    const freeLeadCountsByListing = {};

    // Transform leads with paid vs unpaid rules:
    // • Admin & Editor: 100% full contact details for all leads
    // • Paid Listings: 100% full contact details for all leads
    // • Free Listings: First 7 leads are free & unlocked; lead 8+ locked/masked asking to upgrade
    const result = enquiries.map((enq) => {
      const listing = enq.listingId;
      const isListingPaid = checkIsListingPaid(listing);

      let isUnlocked = isAdminOrEditor || isListingPaid;
      let freeLeadNumber = null;
      let freeQuotaExceeded = false;

      if (!isAdminOrEditor && !isListingPaid) {
        const lidKey = String(listing?._id || enq.listingId || "unknown");
        freeLeadCountsByListing[lidKey] = (freeLeadCountsByListing[lidKey] || 0) + 1;
        freeLeadNumber = freeLeadCountsByListing[lidKey];

        // First 7 leads on free plan are unlocked
        if (freeLeadCountsByListing[lidKey] <= 7) {
          isUnlocked = true;
        } else {
          isUnlocked = false;
          freeQuotaExceeded = true;
        }
      }

      const cc = enq.countryCode
        ? (String(enq.countryCode).startsWith("+")
            ? String(enq.countryCode)
            : `+${enq.countryCode}`)
        : "+971";

      const rawPhone = enq.mobileNumber ? String(enq.mobileNumber) : "";
      const fullPhone = rawPhone ? `${cc} ${rawPhone}` : "";
      const maskedPhone = `${cc} ${maskLeadPhone(rawPhone)}`;
      const maskedEmail = maskLeadEmail(enq.email);

      return {
        id: enq._id,
        _id: enq._id,
        name: enq.fullName,
        fullName: enq.fullName,
        message: enq.message || "",
        status: enq.status || "",
        created_at: enq.createdAt,
        createdAt: enq.createdAt,

        // Listing information
        title:
          listing?.businessName ||
          listing?.title ||
          enq.listingSlug,
        listingName:
          listing?.businessName ||
          listing?.title ||
          enq.listingSlug,
        listingSlug: listing?.slug || enq.listingSlug,
        listingId: listing?._id || enq.listingId,
        listingModel: enq.listingModel,

        // Access & Paid status
        isPaid: isListingPaid,
        isUnlocked,
        isContactLocked: !isUnlocked,
        freeQuotaExceeded,
        freeLeadNumber,
        planName: listing?.plan?.name || (isListingPaid ? "Paid Plan" : "Free Plan"),
        planStatus: listing?.planStatus || (isListingPaid ? "active" : "free"),
        paymentStatus: listing?.paymentStatus || (isListingPaid ? "paid" : "pending"),

        // Contact info: unlocked if paid or within 7 free leads quota or admin/editor
        countryCode: isUnlocked ? cc : "+971",
        ph_number: isUnlocked ? enq.mobileNumber : null,
        mobileNumber: isUnlocked ? enq.mobileNumber : null,
        phone: isUnlocked ? fullPhone : maskedPhone,
        email: isUnlocked ? enq.email : maskedEmail,
        displayPhone: isUnlocked ? fullPhone : maskedPhone,
        displayEmail: isUnlocked ? enq.email : maskedEmail,
      };
    });

    const paidCount = result.filter((r) => r.isUnlocked).length;
    const lockedCount = result.filter((r) => !r.isUnlocked).length;

    return res.json({
      success: true,
      result,
      total,
      summary: {
        total,
        paidCount,
        lockedCount,
      },
      pagination: {
        total,
        page: +page,
        limit: +limit,
        pages: Math.ceil(total / +limit),
      },
    });
  } catch (err) {
    console.error("getMyLeads Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ─── GET /api/listing-features/my-leads/stats  (Filter menu data) ─────────────
 * Returns ALL categories for the current module with listing counts for the owner
 */
export const getMyLeadsStats = async (req, res) => {
  try {
    const { category } = req.query;
    const type = normalizeCategory(category);

    // 1. Get ALL possible categories for this type
    const categories = await Category.find({ type, isDeleted: false })
      .select("name")
      .lean();

    const entry = MODEL_MAP[type];
    if (!entry) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid category" });
    }

    const { model, modelName } = entry;

    // 2. For each category, count enquiries across user's listings in that category
    const stats = await Promise.all(
      categories.map(async (cat) => {
        const listingIds = await model
          .find({
            createdBy: req.user.id,
            category: cat._id,
            isDeleted: false,
          })
          .distinct("_id");

        const count = await Enquiry.countDocuments({
          listingId: { $in: listingIds },
          listingModel: modelName,
          isDeleted: false,
        });

        return {
          id: cat._id,
          title: cat.name,
          queries: count,
        };
      }),
    );

    return res.json({
      success: true,
      results: {
        data: stats,
      },
    });
  } catch (err) {
    console.error("getMyLeadsStats Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/:type/:slug/enquiries  (owner / admin) ─────────────────────────
export const getEnquiries = async (req, res) => {
  try {
    const { type, slug } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    const typeNormalized = normalizeCategory(type);
    const { listing } = await resolveListing(slug, typeNormalized);

    const filter = { listingId: listing._id, isDeleted: false };
    if (status) filter.status = status;

    const [enquiries, total] = await Promise.all([
      Enquiry.find(filter)
        .sort({ createdAt: -1 })
        .skip((+page - 1) * +limit)
        .limit(+limit),
      Enquiry.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: enquiries,
      pagination: {
        total,
        page: +page,
        limit: +limit,
        pages: Math.ceil(total / +limit),
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

// ─── PATCH /api/enquiries/:enquiryId  (mark read / replied) ──────────────────
export const updateEnquiryStatus = async (req, res) => {
  try {
    const { status } = req.body;
    // if (!["new", "read", "replied"].includes(status))
    //   return res.status(422).json({ success: false, message: "Invalid status" });

    const enquiry = await Enquiry.findByIdAndUpdate(
      req.params.enquiryId,
      { status },
      { new: true },
    );

    if (!enquiry)
      return res
        .status(404)
        .json({ success: false, message: "Enquiry not found" });

    // Also sync JobApplication if this was a Job lead
    if (enquiry.listingModel === "Job") {
      try {
        const JobApplication = (await import("../model/jobApplicationSchema.js")).default;
        await JobApplication.findOneAndUpdate(
          { job: enquiry.listingId, email: enquiry.email },
          { status }
        );
      } catch (syncErr) {
        // silent sync
      }
    }

    return res.json({ success: true, data: enquiry });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// for admin
// controllers/adminEnquiry.controller.js
export const getAllBusinessEnquiries = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, type, listingModel } = req.query;

    const modelMap = {
      business: "BusinessListing",
      businesslisting: "BusinessListing",
      property: "PropertyListing",
      properties: "PropertyListing",
      propertylisting: "PropertyListing",
      job: "Job",
      jobs: "Job",
      marketplace: "MarketplaceListing",
      market: "MarketplaceListing",
      marketplacelisting: "MarketplaceListing",
    };

    let targetModel = "BusinessListing";
    if (listingModel && Object.values(modelMap).includes(listingModel)) {
      targetModel = listingModel;
    } else if (type && modelMap[type.toLowerCase()]) {
      targetModel = modelMap[type.toLowerCase()];
    } else if (type === "all") {
      targetModel = "all";
    }

    const filter = {
      isDeleted: false,
    };

    if (targetModel !== "all") {
      filter.listingModel = targetModel;
    }

    // Optional status filter
    if (status) {
      filter.status = status;
    }

    // Optional search (name, email, phone, slug)
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { listingSlug: { $regex: search, $options: "i" } },
        ...(Number(search) ? [{ mobileNumber: Number(search) }] : []),
      ];
    }

    const [enquiries, total, modelCounts] = await Promise.all([
      Enquiry.find(filter)
        .sort({ createdAt: -1 })
        .skip((+page - 1) * +limit)
        .limit(+limit)
        .populate({
          path: "listingId",
          select:
            "businessName title slug contactPersonName email countryCode mobileNumber altCountryCode alternateMobileNumber contact phone plan createdBy",
          populate: {
            path: "plan",
            select: "name slug price planCode planType",
          },
        })
        .populate("listingOwner", "name email mobileNumber phone countryCode"),

      Enquiry.countDocuments(filter),

      Enquiry.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: "$listingModel", count: { $sum: 1 } } },
      ]),
    ]);

    const counts = {
      business: 0,
      properties: 0,
      jobs: 0,
      marketplace: 0,
      all: 0,
    };
    (modelCounts || []).forEach((c) => {
      if (c._id === "BusinessListing") counts.business = c.count;
      else if (c._id === "PropertyListing") counts.properties = c.count;
      else if (c._id === "Job") counts.jobs = c.count;
      else if (c._id === "MarketplaceListing") counts.marketplace = c.count;
      counts.all += c.count;
    });

    return res.json({
      success: true,
      data: enquiries,
      counts,
      pagination: {
        total,
        page: +page,
        limit: +limit,
        pages: Math.ceil(total / +limit),
      },
    });
  } catch (err) {
    console.error("Admin Enquiry Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
