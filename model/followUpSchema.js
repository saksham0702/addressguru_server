import mongoose from "mongoose";

const MODULES = [
  "BusinessListing",
  "MarketplaceListing",
  "PropertyListing",
  "JobListing",
];

// ── Each follow-up log entry created when agent submits the modal ─────────────
const followUpSchema = new mongoose.Schema(
  {
    // Generic ObjectId — no fixed ref, module tells us which collection it points to
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // Which module this listing belongs to
    module: {
      type: String,
      enum: MODULES,
      required: true,
    },

    // The activity option selected (reference to FollowUpConfig option _id)
    activityOptionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // Label stored as snapshot — history stays correct even if option is renamed/deleted
    reason: {
      type: String,
      required: true,
      trim: true,
    },

    // Remark — only present if the selected option had hasRemark: true
    remark: {
      type: String,
      default: null,
      trim: true,
    },

    // Next scheduled follow-up date and time
    nextFollowUpDate: {
      type: Date,
      default: null,
    },

    // Who logged this follow-up (admin or agent)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt auto-managed
  },
);

// ── Compound index — fast lookups by listing + module ────────────────────────
followUpSchema.index({ listing: 1, module: 1, createdAt: -1 });

const FollowUp = mongoose.model("FollowUp", followUpSchema);
export default FollowUp;
