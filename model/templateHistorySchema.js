import mongoose from "mongoose";

const templateHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      required: true,
    },
    type: {
      type: String,
      required: true,
      // 1: Other/General, 2: Email, 3: WhatsApp, 4: SMS (as per frontend mapping)
    },
    msg: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      default: "",
    },
    label: {
      type: String,
      default: "",
    },
    recipient: {
      type: String,
      default: "",
    },
    // Lead-related info
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ListingEnquiry",
      default: null,
    },
    leadName: {
      type: String,
      default: "",
    },
    leadPhone: {
      type: String,
      default: "",
    },
    leadEmail: {
      type: String,
      default: "",
    },
    // Listing info
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    listingName: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const TemplateHistory = mongoose.model("TemplateHistory", templateHistorySchema);

export default TemplateHistory;
