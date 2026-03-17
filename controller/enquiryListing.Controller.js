// controllers/enquiryController.js
import Enquiry        from "../model/listingEnquirySchema.js";
import { resolveListing } from "../utils/resolveListing.js";

// ─── POST /api/:type/:slug/enquiry ────────────────────────────────────────────
// type = business | job | property | marketplace
export const sendEnquiry = async (req, res) => {
  try {
    const { type, slug } = req.params;
    const { fullName, email, countryCode, mobileNumber, message } = req.body;

    // Basic validation
    if (!fullName || !email || !mobileNumber)
      return res.status(422).json({ success: false, message: "fullName, email and mobileNumber are required" });

    const { listing, modelName } = await resolveListing(slug, type);

    const enquiry = await Enquiry.create({
      listingId:    listing._id,
      listingModel: modelName,
      listingSlug:  listing.slug,
      listingOwner: listing.createdBy,      // works for BusinessListing & Job
      fullName,
      email,
      countryCode:  countryCode || 91,
      mobileNumber,
      message,
      ipAddress:    req.ip,
      userAgent:    req.headers["user-agent"],
    });

    // Increment enquiry counter on listing
    await listing.constructor.findByIdAndUpdate(listing._id, {
      $inc: { "stats.enquiries": 1 },
    });

    // TODO: send email / push notification to listing owner

    return res.status(201).json({
      success: true,
      message: "Your enquiry has been sent successfully.",
      data: { id: enquiry._id },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    console.error("sendEnquiry:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/:type/:slug/enquiries  (owner / admin) ─────────────────────────
export const getEnquiries = async (req, res) => {
  try {
    const { type, slug } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    const { listing } = await resolveListing(slug, type);

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