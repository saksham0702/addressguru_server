import mongoose from "mongoose";

const recipientSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    businessName: { type: String, trim: true, default: "" },
    contactPersonName: { type: String, trim: true, default: "" },
    countryCode: { type: String, trim: true, default: "+971" },
    phone: { type: String, trim: true, required: true },
    city: { type: String, trim: true, default: "" },
    slug: { type: String, trim: true, default: "" },
    listingUrl: { type: String, trim: true, default: "" },
    claimUrl: { type: String, trim: true, default: "" },
    sourceModule: {
      type: String,
      enum: ["business", "property", "marketplace", "jobs", "users", "excel", "manual"],
      default: "manual",
    },
    sourceId: { type: mongoose.Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "skipped"],
      default: "pending",
      index: true,
    },
    sentAt: { type: Date, default: null },
    waMessageId: { type: String, default: null },
    errorReason: { type: String, default: null },
    renderedMessage: { type: String, default: "" },
    retryCount: { type: Number, default: 0 },
  },
  { _id: true, timestamps: true }
);

const whatsappCampaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Campaign name is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "draft",
        "queued",
        "running",
        "paused",
        "completed",
        "cancelled",
        "failed",
      ],
      default: "draft",
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["database", "excel", "direct"],
      required: true,
      default: "database",
    },
    sourceFilters: {
      modules: [{ type: String }], // ['business', 'property', 'marketplace', 'jobs', 'users']
      role: { type: mongoose.Schema.Types.Mixed, default: "all" }, // 1, 2, 3, 5 or 'all'
      listingStatus: { type: String, default: "all" }, // 'approved', 'pending', 'all'
      city: { type: String, default: "all" },
      deduplicate: { type: Boolean, default: true },
    },
    excelOriginalName: { type: String, default: null },

    messageType: {
      type: String,
      enum: ["text", "image", "document", "video", "audio"],
      default: "text",
    },
    messageText: {
      type: String,
      required: [true, "Message text is required"],
    },
    mediaUrl: { type: String, default: null },
    mediaFileName: { type: String, default: null },
    mediaMimeType: { type: String, default: null },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsappTemplate",
      default: null,
    },

    // Anti-Ban & Pacing Settings
    antiBanSettings: {
      minDelaySeconds: { type: Number, default: 3, min: 1 }, // min gap (user requested: 3s)
      maxDelaySeconds: { type: Number, default: 20, max: 120 }, // max gap (user requested: 20s)
      batchSize: { type: Number, default: 50 }, // pause after every 50 numbers
      batchCooldownSeconds: { type: Number, default: 60 }, // cooling gap duration (e.g. 60s)
    },

    recipients: [recipientSchema],

    stats: {
      total: { type: Number, default: 0 },
      pending: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
    },

    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    lastProcessedIndex: { type: Number, default: 0 },
    errorMessage: { type: String, default: null },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Helper method to recalculate stats quickly
whatsappCampaignSchema.methods.updateStats = function () {
  const total = this.recipients.length;
  let pending = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const r of this.recipients) {
    if (r.status === "sent") sent++;
    else if (r.status === "failed") failed++;
    else if (r.status === "skipped") skipped++;
    else pending++;
  }

  this.stats = { total, pending, sent, failed, skipped };
  return this.stats;
};

const WhatsappCampaign = mongoose.model("WhatsappCampaign", whatsappCampaignSchema);

export default WhatsappCampaign;
