import mongoose from "mongoose";

// ── Each individual activity option ──────────────────────────────────────────
const activityOptionSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    hasRemark: {
      type: Boolean,
      default: false, // admin toggles whether this option shows a remark box
    },
    remarkRequired: {
      type: Boolean,
      default: false, // if hasRemark is true, is the remark mandatory?
    },
    remarkPlaceholder: {
      type: String,
      default: "Add a remark…",
    },
    isActive: {
      type: Boolean,
      default: true, // soft disable without deleting
    },
    order: {
      type: Number,
      default: 0, // for drag-and-drop ordering
    },
  },
  { _id: true },
);

// ── Top-level config (one doc per module — one shared config across all listings of that type) ──
const followUpConfigSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      enum: ["BusinessListing", "MarketplaceListing", "PropertyListing", "JobListing"],
    },
    options: [activityOptionSchema],
  },
  { timestamps: true },
);

const FollowUpConfig = mongoose.model("FollowUpConfig", followUpConfigSchema);
export default FollowUpConfig;