// models/Enquiry.js
import mongoose from "mongoose";

const ListingEnquirySchema = new mongoose.Schema(
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

    // ─── Sender Info ──────────────────────────────────────────────────────
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
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // ─── Owner (listing creator gets notified) ────────────────────────────
    listingOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    // ─── Status ───────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["new", "read", "replied"],
      default: "new",
    },

    // ─── Meta ─────────────────────────────────────────────────────────────
    ipAddress: String,
    userAgent: String,

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ListingEnquirySchema.index({ listingId: 1, createdAt: -1 });
ListingEnquirySchema.index({ listingOwner: 1, status: 1 });

export default mongoose.model("ListingEnquiry", ListingEnquirySchema);