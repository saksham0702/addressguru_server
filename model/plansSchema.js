// ─── models/planSchema.js ─────────────────────────────────────────────────────
import mongoose from "mongoose";

// ── NEW: one row of the tick/cross comparison table ──────────────────────────
// value can be:
//   true / false   → rendered as a check / cross icon
//   a string        → rendered as text (e.g. "Priority", "Premium Verified")
const tableFeatureSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // stable id, e.g. "websiteLinkDisplay"
    label: { type: String, required: true }, // display text, e.g. "Website Link Display"
    value: { type: mongoose.Schema.Types.Mixed, default: false },
  },
  { _id: false },
);

const planSchema = new mongoose.Schema(
  {
    /*
       IDENTIFICATION
 */
    name: {
      type: String,
      required: true,
      trim: true,
      // e.g. "Free Plan", "Starter Plan", "Growth Plan", "Premium Plan"
    },

    planType: {
      type: String,
      enum: ["business", "marketplace", "property", "job"],
      default: "business",
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      // e.g. "free", "starter", "growth", "premium"
    },

    tagline: {
      type: String,
      default: null,
      // e.g. "Most Popular" — shown as badge on card/table header
    },

    displayOrder: {
      type: Number,
      default: 0,
      // controls left-to-right ordering on frontend — also used by the
      // migration script to map plans onto comparison-table columns
    },

    durationInDays: {
      type: Number,
      default: 0,
    },

    planCode: {
      type: String,
      required: true,
    },

    /* PRICING (AED — UAE Dirham) */

    currency: {
      type: String,
      default: "AED",
      enum: ["AED"],
    },

    price: {
      type: Number,
      required: true,
      default: 0,
      // 0 = free plan — this is the ACTUAL amount charged
    },

    actualPrice: {
      type: Number,
      default: null,
      // e.g. 99 — shown struck-through on frontend. null = no discount badge
    },

    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      // auto-computed below, don't set this manually from the frontend
    },

    billingCycle: {
      type: String,
      enum: ["year", "month", "one_time"],
      default: "year",
    },

    /* =========================
       NEW — COMPARISON TABLE
       One row per feature, shared key across all plans of a planType
       so the frontend can build a single table (rows = features,
       columns = plans). This is what drives the tick/cross table design.
    ========================== */
    tableFeatures: {
      type: [tableFeatureSchema],
      default: [],
    },

    /* =========================
       LEGACY — kept as-is so marketplace/property/job plans
       (which still use the old bullet-list card design) are unaffected.
       Not used by the new business comparison table.
    ========================== */
    features: {
      type: [String],
      default: [],
    },

    limits: {
      descriptionWords: { type: Number, default: 100 },
      businessImages: { type: Number, default: 0 },
    },

    flags: {
      websiteLinkAllowed: { type: Boolean, default: false },
      imagesGalleryAllowed: { type: Boolean, default: false },
      seoOptimised: { type: Boolean, default: false },
      socialMediaLinks: { type: Boolean, default: false },
      leadEnquiryForm: { type: Boolean, default: false },
      performanceInsights: { type: Boolean, default: false },
      verifiedBadge: { type: Boolean, default: false },
      highlightBadge: { type: Boolean, default: false },
      featuredInMainCities: { type: Boolean, default: false },
      topOfSearchResults: { type: Boolean, default: false },
      monthlyOptimisation: { type: Boolean, default: false },
      dedicatedSupport: { type: Boolean, default: false },
      priorityListing: { type: Boolean, default: false },
      videoLinkAllowed: { type: Boolean, default: false },
    },

    /* =========================
       UI / DISPLAY
    ========================== */
    theme: {
      type: String,
      enum: ["default", "blue", "green", "gold"],
      default: "default",
    },

    ctaLabel: {
      type: String,
      default: "Get Started",
    },

    isHighlighted: {
      type: Boolean,
      default: false,
    },

    /* =========================
       STATUS
    ========================== */
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
planSchema.index({ slug: 1 });
planSchema.index({ isActive: 1, isDeleted: 1 });
planSchema.index({ displayOrder: 1 });

// Auto-derive discountPercentage from actualPrice vs price on every save.
planSchema.pre("save", function (next) {
  if (this.actualPrice && this.actualPrice > this.price) {
    this.discountPercentage = Math.round(
      ((this.actualPrice - this.price) / this.actualPrice) * 100,
    );
  } else {
    this.discountPercentage = 0;
  }
  next();
});

export default mongoose.model("Plan", planSchema);
