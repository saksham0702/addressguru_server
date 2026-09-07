import mongoose from "mongoose";

const flashDealSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      // e.g. "Now or Never Deal"
    },
    badgeText: {
      type: String,
      default: "NOW OR NEVER",
    },
    description: {
      type: String,
      default: "",
    },

    // The plan whose FLAGS/FEATURES/durationInDays this deal grants.
    // Price is overridden by dealPrice below.
    basePlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },

    planType: {
      type: String,
      enum: ["business", "marketplace", "property", "job"],
      default: "business",
    },

    currency: { type: String, default: "AED" },

    dealPrice: {
      type: Number,
      required: true,
      min: 0,
      // e.g. 10 — what the user actually pays
    },

    durationMinutes: {
      type: Number,
      required: true,
      default: 5,
      min: 1,
      max: 1440,
    },

    // "first_listing_only" = only shown to users who have never created
    // a listing of this planType before. "all_users" = shown to everyone
    // who hasn't already claimed it.
    eligibility: {
      type: String,
      enum: ["first_listing_only", "all_users"],
      default: "first_listing_only",
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

flashDealSchema.index({ isActive: 1, planType: 1 });

export default mongoose.model("FlashDeal", flashDealSchema);
