// models/ReportAd.js
import mongoose from "mongoose";

export const REPORT_REASONS = [
  "Illegal/Fraudulent",
  "Spam Ad",
  "Duplicate Ad",
  "Ad is in the wrong category",
  "Against Posting Rules",
  "Adult Content",
  "Other",
];

const reportListingSchema = new mongoose.Schema(
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

    // ─── Reporter ─────────────────────────────────────────────────────────
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ─── Report Details ───────────────────────────────────────────────────
    reason: {
      type: String,
      required: [true, "Report reason is required"],
      enum: { values: REPORT_REASONS, message: "Invalid reason" },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Cannot exceed 500 characters"],
    },

    // ─── Admin Review ─────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "reviewed", "dismissed", "action_taken"],
      default: "pending",
      index: true,
    },
    adminNote: { type: String, trim: true },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: { type: Date },

    // ─── Meta ─────────────────────────────────────────────────────────────
    ipAddress: String,
    userAgent: String,
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

reportListingSchema.index({ listingId: 1, ipAddress: 1 });
reportListingSchema.index({ listingId: 1, reportedBy: 1 });
reportListingSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("ReportedListing", reportListingSchema);