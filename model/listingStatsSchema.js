import mongoose from "mongoose";

const listingStatsSchema = new mongoose.Schema(
  {
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "listingModel",
      index: true,
    },
    listingModel: {
      type: String,
      required: true,
      enum: ["BusinessListing", "Job", "PropertyListing", "MarketplaceListing"],
    },
    type: {
      type: String,
      required: true,
      enum: ["view", "call", "website_visit", "lead", "review"],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    ipAddress: {
      type: String,
      default: "Unknown",
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "listing_stats",
  }
);

listingStatsSchema.index({ createdAt: 1 });
listingStatsSchema.index({ listingId: 1, type: 1, createdAt: 1 });
listingStatsSchema.index({ listingId: 1, type: 1, ipAddress: 1, createdAt: 1 }); // for deduplication lookup
export default mongoose.model("ListingStats", listingStatsSchema);