// models/ClaimBusiness.js
import mongoose from "mongoose";

const claimBusinessSchema = new mongoose.Schema(
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

    // ─── Claimant Info ────────────────────────────────────────────────────
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
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
    countryCode: { type: Number, default: 91 },
    mobileNumber: {
      type: Number,
      required: [true, "Mobile number is required"],
    },
    reasonForClaim: {
      type: String,
      required: [true, "Reason for claim is required"],
      trim: true,
      maxlength: 1000,
    },

    // ─── Admin Review ─────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
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

// Only one pending claim per listing at a time
claimBusinessSchema.index(
  { listingId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

export default mongoose.model("ClaimBusiness", claimBusinessSchema);