import Enquiry from "../model/listingEnquirySchema.js";
import User from "../model/userSchema.js";
import ListingStats from "../model/listingStatsSchema.js";
import Category from "../model/categoriesSchema.js";
import { resolveListing, MODEL_MAP } from "../utils/resolveListing.js";
import { sendEnquiryReceivedMail, sendEnquiryConfirmationMail } from "../utils/sendMail.js";

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
      return res.status(422).json({ success: false, message: "fullName, email and mobileNumber are required" });

    const typeNormalized = normalizeCategory(type);
    const { listing, modelName } = await resolveListing(slug, typeNormalized);

    const enquiry = await Enquiry.create({
      listingId: listing._id,
      listingModel: modelName,
      listingSlug: listing.slug,
      listingOwner: listing.createdBy,
      fullName,
      email,
      countryCode: countryCode || 971,
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
    } catch (e) { }

    // ── Send mail to listing owner ─────────────────────────────────────────
    try {
      // Populate owner email if not directly on listing
      const owner = listing.createdBy
        ? await User.findById(listing.createdBy).select("email name").lean()
        : null;

      const ownerEmail = listing.email || owner?.email;
      const ownerName = listing.contactPersonName || owner?.name || listing.businessName;

      if (ownerEmail) {
        await sendEnquiryReceivedMail(
          ownerEmail,
          ownerName,
          listing.businessName || listing.slug,
          listing.slug,
          { fullName, email, countryCode, mobileNumber, message },
        );
        console.log(`✅ Enquiry mail sent to owner: ${ownerEmail}`);
      }
    } catch (mailErr) {
      console.warn("❌ Enquiry mail failed:", mailErr.message);
    }

    // ── Send mail to enquirer ──────────────────────────────────────────────
    try {
      await sendEnquiryConfirmationMail(
        email,
        fullName,
        listing.businessName || listing.slug,
        listing.slug,
        message
      );
      console.log(`✅ Enquiry confirmation mail sent to enquirer: ${email}`);
    } catch (confMailErr) {
      console.warn("❌ Enquiry confirmation mail failed:", confMailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Your enquiry has been sent successfully.",
      data: { id: enquiry._id },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    console.warn("sendEnquiry:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ─── GET /api/listing-features/my-leads  (Owner leads Dashboard) ──────────────
 * Used by mobile app dashboard to show all enquiries for current user
 */
export const getMyLeads = async (req, res) => {
  try {
    const { category, listingId, page = 1, limit = 20 } = req.query;

    console.log("category = ", category);
    console.log("listingId = ", listingId);


    const type = normalizeCategory(category);
    const entry = MODEL_MAP[type];

    if (!entry) {
      return res.status(400).json({ success: false, message: "Invalid category" });
    }

    // console.log("entry = ", entry);


    const { model, modelName } = entry;

    const filter = {
      listingOwner: req.user.id,
      listingModel: modelName,
      isDeleted: false
    };

    // console.log("filter = ", filter);

    if (listingId && listingId !== "" && listingId !== "All") {
      // Find all listings belonging to this category for the user
      const listingIds = await model.find({
        createdBy: req.user.id,
        _id: listingId,
        isDeleted: false
      }).distinct("_id");

      console.log("listingIds = ", listingIds);

      filter.listingId = { $in: listingIds };
    }

    const [enquiries, total] = await Promise.all([
      Enquiry.find(filter)
        .populate({
          path: "listingId",
          select: "businessName title",
        })
        .sort({ createdAt: -1 })
        .skip((+page - 1) * +limit)
        .limit(+limit)
        .lean(),
      Enquiry.countDocuments(filter),
    ]);

    // console.log("enquiries = ", enquiries);
    // console.log("total = ", total);


    // Transform to match frontend CardEnquires expectations
    const result = enquiries.map(enq => ({
      id: enq._id,
      name: enq.fullName,
      ph_number: enq.mobileNumber,
      phone: enq.mobileNumber,
      email: enq.email,
      message: enq.message || "",
      created_at: enq.createdAt,
      title: enq.listingId?.businessName || enq.listingId?.title || enq.listingSlug,
      listingId: enq.listingId?._id || enq.listingId,
    }));

    return res.json({
      success: true,
      result,
      total,
      pagination: { total, page: +page, limit: +limit, pages: Math.ceil(total / +limit) },
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
    const categories = await Category.find({ type, isDeleted: false }).select("name").lean();

    const entry = MODEL_MAP[type];
    if (!entry) {
      return res.status(400).json({ success: false, message: "Invalid category" });
    }

    const { model, modelName } = entry;

    // 2. For each category, count enquiries across user's listings in that category
    const stats = await Promise.all(categories.map(async (cat) => {
      const listingIds = await model.find({
        createdBy: req.user.id,
        category: cat._id,
        isDeleted: false
      }).distinct("_id");

      const count = await Enquiry.countDocuments({
        listingId: { $in: listingIds },
        listingModel: modelName,
        isDeleted: false
      });

      return {
        id: cat._id,
        title: cat.name,
        queries: count
      };
    }));

    return res.json({
      success: true,
      results: {
        data: stats
      }
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
      pagination: { total, page: +page, limit: +limit, pages: Math.ceil(total / +limit) },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── PATCH /api/enquiries/:enquiryId  (mark read / replied) ──────────────────
export const updateEnquiryStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["new", "read", "replied"].includes(status))
      return res.status(422).json({ success: false, message: "Invalid status" });

    const enquiry = await Enquiry.findByIdAndUpdate(
      req.params.enquiryId,
      { status },
      { new: true }
    );

    if (!enquiry)
      return res.status(404).json({ success: false, message: "Enquiry not found" });

    return res.json({ success: true, data: enquiry });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};