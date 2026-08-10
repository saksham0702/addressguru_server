// ─── models/planSchema.js ─────────────────────────────────────────────────────
import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    /*
       IDENTIFICATION
 */
    name: {
      type: String,
      required: true,
      trim: true,
      // e.g. "Free Plan", "Starter Plan", "Growth Plan", "Featured Plan"
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
      // e.g. "free", "starter", "growth", "featured"
    },

    tagline: {
      type: String,
      default: null,
      // e.g. "Most Popular", "Best Visibility" — shown as badge on card
    },

    displayOrder: {
      type: Number,
      default: 0,
      // controls left-to-right ordering on frontend
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
      // 0 = free plan — this is the ACTUAL amount charged, unchanged behavior
    },

    // ── NEW ──────────────────────────────────────────────────────────────
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
    // ─────────────────────────────────────────────────────────────────────
    billingCycle: {
      type: String,
      enum: ["year", "month", "one_time"],
      default: "year",
    },

    /* =========================
       FEATURES / PERKS
       stored as array of strings for easy rendering on frontend
    ========================== */
    features: {
      type: [String],
      default: [],
      // e.g. ["Basic Listing", "100 Words Description", "No Website Link"]
    },

    /* =========================
       LIMITS
    ========================== */
    limits: {
      descriptionWords: { type: Number, default: 100 },
      businessImages: { type: Number, default: 0 },
      // 0 = not allowed
    },

    /* =========================
       FEATURE FLAGS
    ========================== */
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
      // controls card colour accent on frontend
      type: String,
      enum: ["default", "blue", "green", "gold"],
      default: "default",
    },

    ctaLabel: {
      type: String,
      default: "Get Started",
      // button text: "Get Started", "Get Listed", "Get Featured"
    },

    isHighlighted: {
      type: Boolean,
      default: false,
      // true = "Most Popular" banner
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
// This fires on Plan.create() and plan.save() (both used in your controller),
// so admins only ever type actualPrice + price — never the percentage.
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
