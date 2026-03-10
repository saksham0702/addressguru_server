// models/marketplaceListingSchema.js
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
    /* =========================
       BASIC REFERENCES
    ========================== */
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: "SubCategory" },
    city: { type: mongoose.Schema.Types.ObjectId, ref: "City", required: true },

    /* =========================
       STEP 1 – PRODUCT INFO
    ========================== */
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    condition: {
      type: String,
      enum: ["new", "used-like-new", "used-good", "used-fair"],
      required: true,
    },

    price: {
      amount: { type: Number, default: null },
      currency: { type: String, default: "PKR" },
      isNegotiable: { type: Boolean, default: false },
      isFixed: { type: Boolean, default: false },
      isFree: { type: Boolean, default: false },
    },

    // dynamic fields per category
    additionalFields: {
      type: [additionalFieldValueSchema],
      default: [],
    },

    // CategoryFeature-linked arrays
    features: [{ type: mongoose.Schema.Types.ObjectId }],
    paymentModes: [{ type: mongoose.Schema.Types.ObjectId }],

    /* =========================
       STEP 2 – CONTACT DETAILS
    ========================== */
    contactPersonName: String,
    email: { type: String, lowercase: true },
    countryCode: Number,
    mobileNumber: Number,
    altCountryCode: Number,
    alternateMobileNumber: Number,
    locality: String,
    address: String,

    /* =========================
       STEP 3 – SOCIAL & LINKS
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
       STEP 4 – SEO
    ========================== */
    seo: { title: String, description: String },
    slug: { type: String, unique: true, index: true },

    /* =========================
       STEP 5 – MEDIA
    ========================== */
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
    isSold: { type: Boolean, default: false }, // mark as sold without deleting
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    /* =========================
       SOFT DELETE
    ========================== */
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// filter indexes
marketplaceListingSchema.index({ "price.amount": 1 });
marketplaceListingSchema.index({ condition: 1 });
marketplaceListingSchema.index({ category: 1, subCategory: 1 });
marketplaceListingSchema.index({ city: 1 });
marketplaceListingSchema.index({ isSold: 1, isDeleted: 1, isPublished: 1 });

export default mongoose.model("MarketplaceListing", marketplaceListingSchema);
