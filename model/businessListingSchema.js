// models/businessListingSchema.js
import mongoose from "mongoose";

// ─── Sub-schema: one additional field answer ───────────────────────────────
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

const businessListingSchema = new mongoose.Schema(
  {
    /* =========================
       BASIC REFERENCES
    ========================== */
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
    },

    /* =========================
       STEP 1 – BUSINESS INFO
    ========================== */
    businessName: { type: String, required: true, trim: true },
    // removed unique:true from field level — handled in controller
    // to avoid blocking re-creation after soft delete

    businessAddress: { type: String, required: true },
    description: { type: String, required: true },
    establishedYear: { type: Number, default: null },
    taxNumber: { type: String, default: null },

    // Dynamic fields per category
    additionalFields: {
      type: [additionalFieldValueSchema],
      default: [],
    },

    // CategoryFeature-linked arrays
    facilities: [{ type: mongoose.Schema.Types.ObjectId }],
    services: [{ type: mongoose.Schema.Types.ObjectId }],
    courses: [{ type: mongoose.Schema.Types.ObjectId }],
    paymentModes: [{ type: mongoose.Schema.Types.ObjectId }],

    workingHours: { type: Object, default: null },

    /* =========================
       STEP 2 – SOCIAL LINKS
    ========================== */
    websiteLink: { type: String, default: null },
    videoLink: { type: String, default: null },
    socialLinks: {
      facebook: { type: String, default: null },
      instagram: { type: String, default: null },
      twitter: { type: String, default: null },
      linkedin: { type: String, default: null },
      youtube: { type: String, default: null },
    },

    /* =========================
       STEP 3 – CONTACT DETAILS
    ========================== */
    contactPersonName: { type: String },
    email: { type: String, lowercase: true },

    // fixed: was required:true — city is set in step 3, not step 1
    city: { type: mongoose.Schema.Types.ObjectId, ref: "City" },

    // fixed: all were Number — changed to String
    countryCode: { type: String },
    mobileNumber: { type: String },
    altCountryCode: { type: String },
    alternateMobileNumber: { type: String },

    locality: { type: String },

    /* =========================
       STEP 4 – SEO
    ========================== */
    seo: {
      title: { type: String },
      description: { type: String },
    },
    slug: { type: String, unique: true, index: true },

    /* =========================
       STEP 5 – MEDIA
    ========================== */
    logo: { type: String, default: null },
    images: [String],

    /* =========================
       STEP 6 – PLAN & PUBLISH
    ========================== */
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },

    /* =========================
       STATUS & FLOW
    ========================== */
    stepCompleted: { type: Number, default: 1 },
    isVerified: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    provider: {
      type: String,
      enum: ["google", "user"],
      default: "user",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /* =========================
       SOFT DELETE
    ========================== */
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
businessListingSchema.index({ slug: 1 });
businessListingSchema.index({ businessName: 1, isDeleted: 1 }); // for duplicate name check
businessListingSchema.index({ category: 1, subCategory: 1 });
businessListingSchema.index({ city: 1 });
businessListingSchema.index({ isDeleted: 1, isPublished: 1, isVerified: 1 });

export default mongoose.model("BusinessListing", businessListingSchema);
