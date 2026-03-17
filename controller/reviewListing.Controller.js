// controllers/reviewController.js
import Review             from "../model/reviewListingSchema.js";
import { resolveListing } from "../utils/resolveListing.js";

// ─── Helper: recalculate & save rating on listing ─────────────────────────────
async function syncRating(listingId, ListingModel) {
  const result = await Review.aggregate([
    { $match: { listingId, status: "approved", isDeleted: false } },
    { $group: { _id: "$listingId", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const { avg = 0, count = 0 } = result[0] || {};
  await ListingModel.findByIdAndUpdate(listingId, {
    "rating.average": Math.round(avg * 10) / 10,
    "rating.count":   count,
  });
}

// ─── POST /api/:type/:slug/review ─────────────────────────────────────────────
export const submitReview = async (req, res) => {
  try {
    const { type, slug } = req.params;
    const { fullName, email, rating, reviewText } = req.body;

    if (!fullName || !email || !rating)
      return res.status(422).json({ success: false, message: "fullName, email and rating are required" });
    if (rating < 1 || rating > 5)
      return res.status(422).json({ success: false, message: "Rating must be between 1 and 5" });

    const { listing, modelName } = await resolveListing(slug, type);

    // One review per email per listing
    const existing = await Review.findOne({ listingId: listing._id, email });
    if (existing)
      return res.status(400).json({ success: false, message: "You have already reviewed this listing." });

    const review = await Review.create({
      listingId:    listing._id,
      listingModel: modelName,
      listingSlug:  listing.slug,
      reviewer:     req.user?._id,
      fullName,
      email,
      rating:       +rating,
      reviewText,
      ipAddress:    req.ip,
      userAgent:    req.headers["user-agent"],
    });

    await syncRating(listing._id, listing.constructor);

    return res.status(201).json({
      success: true,
      message: "Thank you for your review!",
      data: {
        id:         review._id,
        rating:     review.rating,
        fullName:   review.fullName,
        reviewText: review.reviewText,
        createdAt:  review.createdAt,
      },
    });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success: false, message: "You have already reviewed this listing." });
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/:type/:slug/reviews ─────────────────────────────────────────────
export const getReviews = async (req, res) => {
  try {
    const { type, slug } = req.params;
    const { page = 1, limit = 10, sort = "newest" } = req.query;

    const { listing } = await resolveListing(slug, type);

    const sortMap = {
      newest:  { createdAt: -1 },
      oldest:  { createdAt:  1 },
      highest: { rating: -1 },
      lowest:  { rating:  1 },
    };

    const filter = { listingId: listing._id, status: "approved", isDeleted: false };

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .select("-email -ipAddress -userAgent")
        .sort(sortMap[sort] || sortMap.newest)
        .skip((+page - 1) * +limit)
        .limit(+limit),
      Review.countDocuments(filter),
    ]);

    // Per-star breakdown
    const breakdown = await Review.aggregate([
      { $match: filter },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]);
    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    breakdown.forEach((b) => (ratingBreakdown[b._id] = b.count));

    return res.json({
      success: true,
      data: reviews,
      stats: {
        average:   listing.rating?.average || 0,
        total,
        breakdown: ratingBreakdown,
      },
      pagination: { total, page: +page, limit: +limit, pages: Math.ceil(total / +limit) },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── PATCH /api/admin/reviews/:reviewId  (approve / reject) ──────────────────
export const adminReviewAction = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status))
      return res.status(422).json({ success: false, message: "Invalid status" });

    const review = await Review.findByIdAndUpdate(
      req.params.reviewId,
      { status, approvedBy: req.user?._id },
      { new: true }
    );

    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    // Sync rating after moderation
    const { model } = Object.values(
      (await import("../utils/resolveListing.js")).MODEL_MAP
    ).find(async (_, i) =>
      Object.keys(( await import("../utils/resolveListing.js")).MODEL_MAP)[i] ===
        review.listingModel.toLowerCase().replace("businesslisting", "business")
    ) || {};
    if (model) await syncRating(review.listingId, model);

    return res.json({ success: true, data: review });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── DELETE /api/:type/:slug/reviews/:reviewId ────────────────────────────────
export const deleteReview = async (req, res) => {
  try {
    const { type, slug } = req.params;
    const { listing } = await resolveListing(slug, type);

    const review = await Review.findOneAndUpdate(
      { _id: req.params.reviewId, listingId: listing._id },
      { isDeleted: true },
      { new: true }
    );

    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    await syncRating(listing._id, listing.constructor);

    return res.json({ success: true, message: "Review deleted." });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};