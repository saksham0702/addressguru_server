import mongoose from "mongoose";

const whatsappConfigSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["baileys", "cloud_api"],
      default: "baileys",
    },
    cloudApi: {
      phoneNumberId: { type: String, trim: true, default: "" },
      wabaId: { type: String, trim: true, default: "" },
      accessToken: { type: String, trim: true, default: "" },
      displayPhoneNumber: { type: String, trim: true, default: "" },
      apiVersion: { type: String, trim: true, default: "v20.0" },
      isConfigured: { type: Boolean, default: false },
    },
    allowOfficialApiForBulk: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.WhatsappConfig ||
  mongoose.model("WhatsappConfig", whatsappConfigSchema);
