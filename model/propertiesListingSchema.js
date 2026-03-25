// models/propertyListingSchema.js
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

const propertyListingSchema = new mongoose.Schema(
  {
    /* =========================
       BASIC REFERENCES
    ========================== */
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: "SubCategory" },

    /* =========================
       STEP 1 – PROPERTY INFO
    ========================== */
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    slug: { type: String, unique: true, index: true },

    purpose: {
      type: String,
      enum: ["sale", "rent", "lease"],
      required: true,
    },

    price: {
      amount: { type: Number, default: null },
      currency: { type: String, default: "AED" },
      isNegotiable: { type: Boolean, default: false },
      period: {
        type: String,
        enum: ["monthly", "yearly", "weekly", "one-time"],
        default: "one-time",
      },
    },

    // ── Size ──────────────────────────────────────────────────────────────
    area: {
      size: { type: Number, default: null },
      unit: {
        type: String,
        enum: ["sqft", "sqm", "marla", "kanal"], // fixed: added marla & kanal
        default: "sqft",
      },
    },

    // Dynamic fields per category
    additionalFields: {
      type: [additionalFieldValueSchema],
      default: [],
    },

    paymentModes: [{ type: mongoose.Schema.Types.ObjectId }],

    /* =========================
       STEP 2 – MEDIA
    ========================== */
    images: [String],

    /* =========================
       STEP 3 – CONTACT DETAILS
    ========================== */
    contactPersonName: { type: String },
    email: { type: String, lowercase: true },

    // fixed: was required:true on schema level — city is set in step 3, not step 1
    city: { type: mongoose.Schema.Types.ObjectId, ref: "City" },

    // fixed: all were Number — changed to String
    countryCode: { type: String },
    mobileNumber: { type: String },
    altCountryCode: { type: String },
    alternateMobileNumber: { type: String },

    location: {
      address: { type: String },
      locality: { type: String },
      mapLat: { type: Number },
      mapLng: { type: Number },
    },

    /* =========================
       STEP 4 – SEO
    ========================== */
    seo: {
      title: { type: String },
      description: { type: String },
    },

    /* =========================
       STEP 5 – PLAN
    ========================== */
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },

    /* =========================
       STATUS & FLOW
    ========================== */
    stepCompleted: { type: Number, default: 1 },
    isVerified: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
    isSold: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    /* =========================
       SOFT DELETE
    ========================== */
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
propertyListingSchema.index({ slug: 1 });
propertyListingSchema.index({ "price.amount": 1 });
propertyListingSchema.index({ purpose: 1 });
propertyListingSchema.index({ "area.size": 1, "area.unit": 1 });
propertyListingSchema.index({ category: 1, subCategory: 1 });
propertyListingSchema.index({ city: 1 });
propertyListingSchema.index({ isSold: 1, isDeleted: 1, isPublished: 1 });

export default mongoose.model("PropertyListing", propertyListingSchema);
