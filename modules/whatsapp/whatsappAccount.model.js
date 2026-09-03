// modules/whatsapp/models/whatsappAccountSchema.js
import mongoose from "mongoose";

/**
 * One document per connected WhatsApp number/session.
 * authCreds/authKeys hold the serialized Baileys auth state (creds + signal keys).
 * These are select:false so they are NEVER returned by normal API responses/populates.
 */
const whatsappAccountSchema = new mongoose.Schema(
  {
    label: { type: String, default: "default", unique: true }, // supports multiple accounts later (e.g. "support", "sales")
    phoneNumber: { type: String, default: null }, // connected WA number once linked, e.g. "971501234567"

    status: {
      type: String,
      enum: [
        "disconnected",
        "connecting",
        "qr_pending",
        "connected",
        "logged_out",
      ],
      default: "disconnected",
    },

    qr: { type: String, default: null, select: false }, // current QR as a data URL, only returned via the dedicated QR endpoint

    lastConnectedAt: { type: Date, default: null },
    lastDisconnectedAt: { type: Date, default: null },
    disconnectReason: { type: String, default: null },

    // Baileys auth state — never exposed to the frontend.
    authCreds: { type: String, default: null, select: false },
    authKeys: { type: String, default: null, select: false },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("WhatsappAccount", whatsappAccountSchema);
