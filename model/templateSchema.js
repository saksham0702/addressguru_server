import mongoose from "mongoose";

const templateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["whatsapp", "sms", "email"],
      required: true,
      lowercase: true,
    },
    subject: {
      type: String,
      required: false,
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "business_pitch",
        "listing_approved",
        "listing_rejected",
        "lead_notification",
        "claim_verification",
        "claim_transferred",
        "claim_rejected",
        "custom",
      ],
      default: "custom",
    },
    variables: {
      type: [String],
      default: [],
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Template = mongoose.model("Template", templateSchema);

export default Template;
