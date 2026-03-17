// models/Listing.js
import mongoose from "mongoose";

// ─── Sub-schema: one additional field answer ───────────────────────────────
const additionalFieldValueSchema = new mongoose.Schema(
  {
    field_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdditionalField",
      required: true,
    },
    field_label: {
      type: String,
      required: true, // snapshot of label at time of save
    },
    field_type: {
      type: String,
      required: true, // snapshot of type (text / number / checkbox …)
    },
    value: {
      type: mongoose.Schema.Types.Mixed, // string | number | string[]
      default: null,
    },
  },
  { _id: false }, // no separate _id per answer – field_id is the key
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
    businessName: { type: String, required: true, unique: true, trim: true },
    businessAddress: { type: String, required: true },
    description: { type: String, required: true },
    establishedYear: { type: Number },
    taxNumber: { type: String },

    /*  ADDITIONAL / DYNAMIC FIELDS
       (answers to AdditionalField docs for this category) */
    additionalFields: {
      type: [additionalFieldValueSchema],
      default: [],
    },

    // ── CategoryFeature-linked arrays ──────────────────────────────────────
    // Each ObjectId points to an item inside Feature.items[]
    facilities: [{ type: mongoose.Schema.Types.ObjectId }],
    services: [{ type: mongoose.Schema.Types.ObjectId }],
    courses: [{ type: mongoose.Schema.Types.ObjectId }],
    paymentModes: [{ type: mongoose.Schema.Types.ObjectId }],

    workingHours: { type: Object },

    /* =========================
       STEP 2 – SOCIAL LINKS
    ========================== */
    websiteLink: String,
    videoLink: String,
    socialLinks: {
      facebook: String,
      instagram: String,
      twitter: String,
      linkedin: String,
      youtube: String,
    },

    /* =========================
       STEP 3 – CONTACT DETAILS
    ========================== */
    contactPersonName: String,
    email: { type: String, lowercase: true },
    countryCode: Number,
    mobileNumber: Number,
    altCountryCode: Number,
    alternateMobileNumber: Number,
    locality: String,
    // city: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "City",
    //   // required: true,
    // },
    city: { type: String },

    /* =========================
       STEP 4 – SEO
    ========================== */
    seo: { title: String, description: String },
    slug: { type: String, unique: true, index: true },

    /* =========================
       STEP 5 – MEDIA
    ========================== */
    logo: String,
    images: [String],

    /* =========================
       STEP 6 – PLAN
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
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    /* =========================
       SOFT DELETE
    ========================== */
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model("BusinessListing", businessListingSchema);

// GET /api/additional-fields?category=<id>&subcategory=<id>
