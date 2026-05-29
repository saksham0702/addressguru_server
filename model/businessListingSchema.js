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
    facilities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Feature" }],
    services: [{ type: mongoose.Schema.Types.ObjectId, ref: "Feature" }],
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Feature" }],
    paymentModes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Feature" }],

    workingHours: { type: Object, default: null },

    /* STEP 2 – SOCIAL LINKS */
    websiteLink: { type: String, default: null },
    videoLink: { type: String, default: null },
    socialLinks: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        facebook: null,
        instagram: null,
        twitter: null,
        linkedin: null,
        youtube: null,
      },
    },
    /* STEP 3 – CONTACT DETAILS */
    contactPersonName: { type: String },
    email: { type: String, lowercase: true },

    // fixed: was required:true — city is set in step 3, not step 1
    city: { type: mongoose.Schema.Types.ObjectId, ref: "City" },
    // Add this field to your schema
    cityNameLower: {
      type: String,
      index: true,
      default: "",
    },

    // fixed: all were Number — changed to String
    countryCode: { type: String },
    mobileNumber: { type: String },
    altCountryCode: { type: String },
    alternateMobileNumber: { type: String },

    locality: { type: String },

    /* STEP 4 – SEO */
    seo: {
      title: { type: String },
      description: { type: String },
    },
    slug: { type: String, unique: true, index: true },

    /* STEP 5 – MEDIA*/
    logo: { type: String, default: null },
    images: [{ type: String, max: 10 }],

    /* STEP 6 – PLAN & PUBLISH */
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    /* STATUS & FLOW */
    stepCompleted: { type: Number, default: 1 },
    isVerified: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    leadStatus: {
      type: String,
      enum: ["hot", "warm", "cold", "new"],
      default: "new",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },

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

    // added for search
    searchText: {
      type: String,
      index: true,
    },

    /* SOFT DELETE */
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

businessListingSchema.pre("save", function (next) {
  if (Array.isArray(this.socialLinks)) {
    this.socialLinks = this.socialLinks[0] || {};
  }
  next();
});

businessListingSchema.pre(
  [
    "update",
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "findByIdAndUpdate",
  ],
  function (next) {
    const update = this.getUpdate();
    if (update && update.$set && Array.isArray(update.$set.socialLinks)) {
      update.$set.socialLinks = update.$set.socialLinks[0] || {};
    } else if (update && Array.isArray(update.socialLinks)) {
      update.socialLinks = update.socialLinks[0] || {};
    }
    next();
  },
);

export default mongoose.model("BusinessListing", businessListingSchema);
