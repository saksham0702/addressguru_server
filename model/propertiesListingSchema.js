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
    city: { type: mongoose.Schema.Types.ObjectId, ref: "City", required: true },

    /* =========================
       STEP 1 – PROPERTY INFO
    ========================== */
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    purpose: {
      type: String,
      enum: ["sale", "rent", "lease"], // for-sale / for-rent / for-lease
      required: true,
    },

    propertyType: {
      type: String,
      enum: [
        "house",
        "apartment",
        "plot",
        "commercial",
        "office",
        "shop",
        "warehouse",
        "room",
        "other",
      ],
      required: true,
    },

    price: {
      amount: { type: Number, default: null },
      currency: { type: String, default: "PKR" },
      isNegotiable: { type: Boolean, default: false },
      period: {
        // relevant for rent/lease
        type: String,
        enum: ["monthly", "yearly", "weekly", "one-time"],
        default: "one-time",
      },
    },

    // ── Size ──────────────────────────────────────────────────────────────
    area: {
      size: { type: Number }, // numeric value e.g. 5
      unit: {
        type: String,
        enum: ["marla", "kanal", "sqft", "sqm", "sqyd"],
        default: "marla",
      },
    },

    // ── Rooms ─────────────────────────────────────────────────────────────
    bedrooms: { type: Number, default: null },
    bathrooms: { type: Number, default: null },

    floorNumber: { type: Number, default: null }, // which floor
    totalFloors: { type: Number, default: null }, // total floors in building

    constructionStatus: {
      type: String,
      enum: ["ready", "under-construction", "off-plan"],
      default: "ready",
    },

    furnishing: {
      type: String,
      enum: ["furnished", "semi-furnished", "unfurnished"],
      default: "unfurnished",
    },

    // dynamic fields per category
    additionalFields: {
      type: [additionalFieldValueSchema],
      default: [],
    },

    // CategoryFeature-linked arrays
    amenities: [{ type: mongoose.Schema.Types.ObjectId }], // parking, pool, gym…
    utilities: [{ type: mongoose.Schema.Types.ObjectId }], // gas, water, electricity…
    nearbyPlaces: [{ type: mongoose.Schema.Types.ObjectId }], // school, hospital, market…
    paymentModes: [{ type: mongoose.Schema.Types.ObjectId }],

    /* =========================
       STEP 2 – LOCATION
    ========================== */
    location: {
      address: String,
      locality: String,
      mapLat: Number, // latitude  for map pin
      mapLng: Number, // longitude for map pin
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

    /* =========================
       STEP 4 – SOCIAL & LINKS
    ========================== */
    websiteLink: String,
    videoLink: String,
    socialLinks: {
      facebook: String,
      instagram: String,
      youtube: String,
    },

    /* =========================
       STEP 5 – SEO
    ========================== */
    seo: { title: String, description: String },
    slug: { type: String, unique: true, index: true },

    /* =========================
       STEP 6 – MEDIA
    ========================== */
    images: [String],
    floorPlan: String, // single floor plan image URL

    /* =========================
       STEP 7 – PLAN
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

// filter indexes
propertyListingSchema.index({ "price.amount": 1 });
propertyListingSchema.index({ purpose: 1 });
propertyListingSchema.index({ propertyType: 1 });
propertyListingSchema.index({ "area.size": 1, "area.unit": 1 });
propertyListingSchema.index({ bedrooms: 1, bathrooms: 1 });
propertyListingSchema.index({ furnishing: 1 });
propertyListingSchema.index({ constructionStatus: 1 });
propertyListingSchema.index({ category: 1, subCategory: 1 });
propertyListingSchema.index({ city: 1 });
propertyListingSchema.index({ isSold: 1, isDeleted: 1, isPublished: 1 });

export default mongoose.model("PropertyListing", propertyListingSchema);
