// models/Review.js
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    // ─── Listing Reference (polymorphic) ──────────────────────────────────
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "listingModel",
      index: true,
    },
    listingModel: {
      type: String,
      required: true,
      enum: ["BusinessListing", "Job", "Property", "Marketplace"],
    },
    listingSlug: {
      type: String,
      required: true,
      index: true,
    },

    // ─── Reviewer ─────────────────────────────────────────────────────────
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
    },

    // ─── Review Content ───────────────────────────────────────────────────
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Min rating is 1"],
      max: [5, "Max rating is 5"],
    },
    reviewText: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    // ─── Moderation ───────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved", // set to "pending" to enable pre-moderation
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ─── Meta ─────────────────────────────────────────────────────────────
    ipAddress: String,
    userAgent: String,
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One review per email per listing
reviewSchema.index({ listingId: 1, email: 1 }, { unique: true });
reviewSchema.index({ listingId: 1, status: 1, createdAt: -1 });

export default mongoose.model("ReviewListing", reviewSchema);