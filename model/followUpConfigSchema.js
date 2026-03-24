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

// ── Top-level config (one doc per "type" — listings, leads, etc.) ─────────────
const followUpConfigSchema = new mongoose.Schema(
  {
    // e.g. "listing", "lead", "crm" — lets you reuse this for other modules
    module: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      enum: ["listing", "lead", "crm"],
      default: "listing",
    },
    options: [activityOptionSchema],
  },
  { timestamps: true },
);

const FollowUpConfig = mongoose.model("FollowUpConfig", followUpConfigSchema);
export default FollowUpConfig;
