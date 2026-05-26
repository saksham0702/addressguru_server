import Review from "../model/reviewListingSchema.js";
import User from "../model/userSchema.js";
import ListingStats from "../model/listingStatsSchema.js";
import { MODEL_MAP, resolveListing } from "../utils/resolveListing.js";
import { successData, errorData } from "../services/helper.js";

// ─── Helper: recalculate & save rating on listing ─────────────────────────────
async function syncRating(listingId, ListingModel) {
  const result = await Review.aggregate([
    { $match: { listingId, status: "approved", isDeleted: false } },
    {
      $group: {
        _id: "$listingId",
        avg: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const { avg = 0, count = 0 } = result[0] || {};

  await ListingModel.findByIdAndUpdate(listingId, {
    "rating.average": Math.round(avg * 10) / 10,
    "rating.count": count,
  });
}

// ─── POST /api/:type/:slug/review ─────────────────────────────────────────────
export const submitReview = async (req, res) => {
  try {
    const { type, slug } = req.params;
    const { fullName, email, rating, reviewText } = req.body;

    // ── Basic validation ───────────────────────────────────────────────────
    if (!fullName || !email || !rating) {
      return res.status(422).json({
        success: false,
        message: "fullName, email and rating are required",
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(422).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // ── Resolve listing ────────────────────────────────────────────────────
    const { listing, modelName } = await resolveListing(slug, type);

    // ── 🔥 CHECK: User must exist ──────────────────────────────────────────
    const existingUser = await User.findOne({ email })
      .select("_id name email")
      .lean();

    if (!existingUser) {
      return res.status(401).json({
        success: false,
        message: "Please register first to submit a review.",
      });
    }

    // ── Check duplicate review (per email per listing) ─────────────────────
    const existingReview = await Review.findOne({
      listingId: listing._id,
      email,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this listing.",
      });
    }

    // ── Create review ──────────────────────────────────────────────────────
    const review = await Review.create({
      listingId: listing._id,
      listingModel: modelName,
      listingSlug: listing.slug,

      reviewer: existingUser._id, // ✅ enforce real user
      fullName: existingUser.name || fullName, // ✅ prevent fake name override
      email,

      rating: +rating,
      reviewText,

      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // ── Record stats ───────────────────────────────────────────────────────
    await ListingStats.create({
      listingId: listing._id,
      listingModel: modelName,
      type: "review",
      userId: existingUser._id, // ✅ always real user now
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // ── Increment listing owner's stats ────────────────────────────────────
    if (listing.createdBy) {
      await User.findByIdAndUpdate(listing.createdBy, {
        $inc: { statistics_totalReviews: 1 },
      });
    }

    // ── Response ───────────────────────────────────────────────────────────
    return res.status(201).json({
      success: true,
      message: "Review submitted successfully and is pending approval.",
      data: {
        id: review._id,
        rating: review.rating,
        fullName: review.fullName,
        reviewText: review.reviewText,
        createdAt: review.createdAt,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this listing.",
      });
    }

    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─── GET /api/:type/:slug/reviews ─────────────────────────────────────────────
export const getReviews = async (req, res) => {
  try {
    const { type, slug } = req.params;
    const { page = 1, limit = 10, sort = "newest" } = req.query;

    const { listing } = await resolveListing(slug, type);

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest: { rating: -1 },
      lowest: { rating: 1 },
    };

    const filter = {
      listingId: listing._id,
      status: "approved",
      isDeleted: false,
    };

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
        average: listing.rating?.average || 0,
        total,
        breakdown: ratingBreakdown,
      },
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

/**
 * ─── GET /api/listing-features/my-reviews  (Dashboard Reviews) ──────────────
 * Fetches all reviews for listings owned by the current user.
 */
export const getMyReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = "newest" } = req.query;

    // 1. Get all listing IDs belonging to the user across all models
    const listingIds = [];
    const userId = req.user.id || req.user._id;
    await Promise.all(
      Object.values(MODEL_MAP).map(async ({ model }) => {
        const ids = await model
          .find({ createdBy: userId, isDeleted: false })
          .distinct("_id");
        listingIds.push(...ids);
      }),
    );

    if (listingIds.length === 0) {
      return successData(res, 200, true, "No reviews found", {
        listings: [],
        total: 0,
        statistics: { total: 0, approved: 0, pending: 0, rejected: 0 },
        pagination: { total: 0, page: +page, limit: +limit, pages: 0 },
      });
    }

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest: { rating: -1 },
      lowest: { rating: 1 },
    };

    const filter = { listingId: { $in: listingIds }, isDeleted: false };

    const [reviews, total, stats] = await Promise.all([
      Review.find(filter)
        .populate({
          path: "listingId",
          select: "businessName title slug",
        })
        .sort(sortMap[sort] || sortMap.newest)
        .skip((+page - 1) * +limit)
        .limit(+limit)
        .lean(),
      Review.countDocuments(filter),
      Review.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const statistics = {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
    };

    stats.forEach((s) => {
      if (s._id === "approved") statistics.approved = s.count;
      if (s._id === "pending") statistics.pending = s.count;
      if (s._id === "rejected") statistics.rejected = s.count;
      statistics.total += s.count;
    });

    // Transform for frontend expectations
    const result = reviews.map((rev) => ({
      ...rev,
      id: rev._id,
      title:
        rev.listingId?.businessName || rev.listingId?.title || rev.listingSlug,
      // Map schema fields to what CardReview2 expects:
      name: rev.fullName,
      rating_email: rev.email,
      message: rev.reviewText,
      created_at: new Date(rev.createdAt).toLocaleDateString(),
    }));

    return successData(res, 200, true, "Reviews fetched successfully", {
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
    console.error("getMyReviews Error:", err);
    return errorData(res, 500, false, "Server error");
  }
};

/**
 * ─── GET /api/listing-features/my-reviews/stats  (Dashboard Header Stats) ──────
 */
export const getMyReviewsStats = async (req, res) => {
  try {
    const listingIds = [];
    const userId = req.user.id || req.user._id;
    await Promise.all(
      Object.values(MODEL_MAP).map(async ({ model }) => {
        const ids = await model
          .find({ createdBy: userId, isDeleted: false })
          .distinct("_id");
        listingIds.push(...ids);
      }),
    );

    const filter = { listingId: { $in: listingIds }, isDeleted: false };

    const stats = await Review.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const result = {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
    };

    stats.forEach((s) => {
      if (s._id === "approved") result.approved = s.count;
      if (s._id === "pending") result.pending = s.count;
      if (s._id === "rejected") result.rejected = s.count;
      result.total += s.count;
    });

    return successData(res, 200, true, "Review stats fetched", {
      statistics: result,
    });
  } catch (err) {
    console.error("getMyReviewsStats Error:", err);
    return errorData(res, 500, false, "Server error");
  }
};

// ─── PATCH /api/admin/reviews/:reviewId ──────────────────
export const adminReviewAction = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(422).json({
        success: false,
        message: "Invalid status",
      });
    }

    const review = await Review.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (review.status === status) {
      return res.status(400).json({
        success: false,
        message: `Review already ${status}`,
      });
    }

    // ✅ THIS WAS MISSING
    review.status = status;

    review.approvedBy = req.user._id;

    await review.save();

    // Sync listing ratings
    const ListingModel =
      MODEL_MAP[
        review.listingModel.toLowerCase().replace("businesslisting", "business")
      ]?.model;

    if (ListingModel) {
      await syncRating(review.listingId, ListingModel);
    }

    return res.json({
      success: true,
      message: `Review ${status} successfully`,
      data: review,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
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
      { new: true },
    );

    if (!review)
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    await syncRating(listing._id, listing.constructor);

    return res.json({ success: true, message: "Review deleted." });
  } catch (err) {
    if (err.status)
      return res
        .status(err.status)
        .json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/admin/reviews ─────────────────────────────────────────────
export const getAllReviewsAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = "newest",
      status,
      search = "",
    } = req.query;

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest: { rating: -1 },
      lowest: { rating: 1 },
    };

    // ── Filters ─────────────────────────────────────
    const filter = {
      isDeleted: false,
    };

    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { reviewText: { $regex: search, $options: "i" } },
        { listingSlug: { $regex: search, $options: "i" } },
      ];
    }

    // ── Query ──────────────────────────────────────
    const [reviews, total, stats] = await Promise.all([
      Review.find(filter)
        .populate({
          path: "listingId",
          select: "businessName title slug",
        })
        .populate({
          path: "reviewer",
          select: "name email",
        })
        .populate({
          path: "approvedBy",
          select: "name email",
        })
        .sort(sortMap[sort] || sortMap.newest)
        .skip((+page - 1) * +limit)
        .limit(+limit)
        .lean(),

      Review.countDocuments(filter),

      Review.aggregate([
        {
          $match: { isDeleted: false },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // ── Statistics ─────────────────────────────────
    const statistics = {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
    };

    stats.forEach((s) => {
      statistics[s._id] = s.count;
      statistics.total += s.count;
    });

    // ── Transform ──────────────────────────────────
    const result = reviews.map((rev) => ({
      id: rev._id,

      reviewerName: rev.fullName,
      reviewerEmail: rev.email,

      rating: rev.rating,
      reviewText: rev.reviewText,

      status: rev.status,

      listingTitle:
        rev.listingId?.businessName || rev.listingId?.title || rev.listingSlug,

      listingSlug: rev.listingSlug,
      listingModel: rev.listingModel,

      approvedBy: rev.approvedBy?.name || null,

      createdAt: rev.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: result,

      statistics,

      pagination: {
        total,
        page: +page,
        limit: +limit,
        pages: Math.ceil(total / +limit),
      },
    });
  } catch (err) {
    console.error("getAllReviewsAdmin Error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
