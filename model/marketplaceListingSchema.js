// ─── models/marketplaceListingSchema.js ──────────────────────────────────────
import mongoose from "mongoose";

const additionalFieldValueSchema = new mongoose.Schema(
  {
    field_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdditionalField",
      required: true,
    },
    field_label: { type: String, required: true },
    field_type: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const marketplaceListingSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: "SubCategory" },

    // ── Step 1 – Product Info ──────────────────────────────────────────────
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    slug: { type: String, unique: true, index: true },
    condition: { type: String, required: true },

    price: {
      amount: { type: Number, default: null },
      currency: { type: String, default: "AED" },
      isNegotiable: { type: Boolean, default: false },
      isFixed: { type: Boolean, default: false },
      isFree: { type: Boolean, default: false },
    },

    // Dynamic fields per category
    additionalFields: {
      type: [additionalFieldValueSchema],
      default: [],
    },

    // ── Step 2 – Media ────────────────────────────────────────────────────
    images: [String],

    // ── Step 3 – Contact Details ──────────────────────────────────────────
    contactPersonName: { type: String },
    email: { type: String, lowercase: true },
    countryCode: { type: String }, // e.g. "+971" — kept as String
    mobileNumber: { type: String }, // String to preserve leading zeros / intl format
    altCountryCode: { type: String }, // fixed: was Number, should be String
    alternateMobileNumber: { type: String }, // fixed: was Number, should be String
    locality: { type: String },
    address: { type: String },
    city: { type: mongoose.Schema.Types.ObjectId, ref: "City" },

    // ── Step 4 – SEO ──────────────────────────────────────────────────────
    seo: {
      title: { type: String },
      description: { type: String },
    },

    // ── Step 5 – Plan & Publish ───────────────────────────────────────────
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },

    // ── Status & Flow ─────────────────────────────────────────────────────
    stepCompleted: { type: Number, default: 1 },
    isVerified: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
    isSold: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // ── Soft Delete ───────────────────────────────────────────────────────
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
marketplaceListingSchema.index({ slug: 1 });
marketplaceListingSchema.index({ "price.amount": 1 });
marketplaceListingSchema.index({ condition: 1 });
marketplaceListingSchema.index({ category: 1, subCategory: 1 });
marketplaceListingSchema.index({ city: 1 });
marketplaceListingSchema.index({ isSold: 1, isDeleted: 1, isPublished: 1 });

export default mongoose.model("MarketplaceListing", marketplaceListingSchema);
