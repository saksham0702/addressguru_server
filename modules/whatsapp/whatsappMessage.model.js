// modules/whatsapp/models/whatsappMessageSchema.js
import mongoose from "mongoose";

/**
 * We deliberately do NOT store the raw Baileys message object.
 * Only the useful, queryable fields are persisted here.
 */
const whatsappMessageSchema = new mongoose.Schema(
  {
    whatsappAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsappAccount",
      required: true,
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsappChat",
      required: true,
    },

    waMessageId: { type: String, required: true }, // Baileys message key.id

    direction: { type: String, enum: ["inbound", "outbound"], required: true },

    senderPhone: { type: String, required: true },
    receiverPhone: { type: String, required: true },

    messageType: {
      type: String,
      enum: [
        "text",
        "image",
        "video",
        "audio",
        "document",
        "sticker",
        "location",
        "contact",
        "unknown",
      ],
      default: "text",
    },

    content: { type: String, default: null }, // text body / caption / short description
    mediaUrl: { type: String, default: null }, // only populated if/when you add media download+storage

    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "read", "failed"],
      default: "pending",
    },
    failReason: { type: String, default: null },

    timestamp: { type: Date, required: true },

    // ── Business relationships — populated only when identifiable, reusing existing collections ──
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    businessListing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessListing",
      default: null,
    },
    propertyListing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyListing",
      default: null,
    },
    marketplaceListing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceListing",
      default: null,
    },
    job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", default: null },
  },
  { timestamps: true },
);

whatsappMessageSchema.index(
  { whatsappAccount: 1, waMessageId: 1 },
  { unique: true },
);
whatsappMessageSchema.index({ chat: 1, timestamp: -1 });
whatsappMessageSchema.index({ user: 1 });
whatsappMessageSchema.index({ businessListing: 1 });
whatsappMessageSchema.index({ propertyListing: 1 });
whatsappMessageSchema.index({ marketplaceListing: 1 });
whatsappMessageSchema.index({ job: 1 });

export default mongoose.model("WhatsappMessage", whatsappMessageSchema);
