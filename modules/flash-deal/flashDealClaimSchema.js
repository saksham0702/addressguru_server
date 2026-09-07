import mongoose from "mongoose";

const flashDealClaimSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FlashDeal",
      required: true,
    },

    // Attached once the user actually has a listing draft in progress.
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    planType: { type: String, default: "business" },

    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },

    status: {
      type: String,
      enum: ["active", "expired", "purchased"],
      default: "active",
    },
    purchasedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One claim per user per deal — this IS the "never visible again" guarantee.
flashDealClaimSchema.index({ user: 1, deal: 1 }, { unique: true });

export default mongoose.model("FlashDealClaim", flashDealClaimSchema);
