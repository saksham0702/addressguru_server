// modules/whatsapp/models/whatsappChatSchema.js
import mongoose from "mongoose";

const whatsappChatSchema = new mongoose.Schema(
  {
    whatsappAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsappAccount",
      required: true,
    },
    jid: { type: String, required: true }, // WhatsApp JID, e.g. 9715xxxxxxx@s.whatsapp.net or LID
    lid: { type: String, default: null }, // Linked LID if known, e.g. 27079819165886@lid
    phone: { type: String, required: true }, // normalized phone (digits only), derived from jid/phone

    name: { type: String, default: null }, // WhatsApp pushName / contact name if known

    // Reuse existing User record when this phone number matches one — do not duplicate user data here.
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: null },
    unreadCount: { type: Number, default: 0 },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

whatsappChatSchema.index({ whatsappAccount: 1, jid: 1 });
whatsappChatSchema.index({ whatsappAccount: 1, lid: 1 });
whatsappChatSchema.index({ phone: 1 });
whatsappChatSchema.index({ user: 1 });
whatsappChatSchema.index({ lastMessageAt: -1 });

export default mongoose.model("WhatsappChat", whatsappChatSchema);

