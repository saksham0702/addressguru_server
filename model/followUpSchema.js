import mongoose from "mongoose";

// ── Each follow-up log entry created when agent submits the modal ─────────────
const followUpSchema = new mongoose.Schema(
  {
    // Which listing this follow-up belongs to  
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessListing",
      required: true,
    },

    // The activity option selected (reference to FollowUpConfig option _id)
    activityOptionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // Label stored directly so history still shows correctly
    // even if admin later renames or deletes that option
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

    // Which module this log belongs to — future-proofing for leads/crm
    module: {
      type: String,
      enum: ["listing", "lead", "crm"],
      default: "listing",
    },
  },
  {
    timestamps: true, // createdAt, updatedAt auto-managed
  },
);

// ── Index for fast lookups by listing ────────────────────────────────────────
followUpSchema.index({ listing: 1, createdAt: -1 });

const FollowUp = mongoose.model("FollowUp", followUpSchema);
export default FollowUp;
