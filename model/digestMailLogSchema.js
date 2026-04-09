import mongoose from "mongoose";

const digestMailLogSchema = new mongoose.Schema(
  {
    // ── Recipient ──────────────────────────────────────────────────────────
    sentTo: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    recipientName: {
      type: String,
      required: true,
      trim: true,
    },

    // ── Category context ───────────────────────────────────────────────────
    categorySlug: {
      type: String,
      required: true,
    },
    categoryName: {
      type: String,
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    // ── Snapshot of what was sent ──────────────────────────────────────────
    listingsCount: {
      type: Number,
      default: 0,
    },
    listingsSent: [
      {
        businessName:  { type: String },
        slug:          { type: String },
        contactPerson: { type: String },
        phone:         { type: String },
        email:         { type: String },
        logoUrl:       { type: String },
        listingRef:    { type: mongoose.Schema.Types.ObjectId, ref: "BusinessListing" },
      },
    ],

    // ── Status ─────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["sent", "failed"],
      default: "sent",
    },
    failureReason: {
      type: String,
      default: null,
    },

    // ── Sent by (admin/user who triggered it) ──────────────────────────────
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("DigestMailLog", digestMailLogSchema);