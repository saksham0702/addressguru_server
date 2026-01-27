import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
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

    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City",
      required: true, // Dubai cities
    },

    /* =========================
       STEP 1 – BUSINESS INFO
    ========================== */
    businessName: {
      type: String,
      required: true,
      trim: true,
    },

    businessAddress: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    facilities: [
      {
        type: mongoose.Schema.Types.ObjectId, // Feature.items._id
      },
    ],

    services: [
      {
        type: mongoose.Schema.Types.ObjectId,
      },
    ],

    paymentModes: [
      {
        type: mongoose.Schema.Types.ObjectId,
      },
    ],

    workingHours: {
      type: Object, // JSON schedule
    },

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

    email: {
      type: String,
      lowercase: true,
    },

    mobileNumber: {
      type: String,
    },

    alternateMobileNumber: String,

    locality: String,

    /* =========================
       STEP 4 – SEO
    ========================== */
    seo: {
      title: String,
      description: String,
    },

    slug: {
      type: String,
      unique: true,
      index: true,
    },

    /* =========================
       STEP 5 – MEDIA
    ========================== */
    logo: {
      type: String, // file path / url
    },

    images: [
      {
        type: String, // file paths / urls
      },
    ],

    /* =========================
       STEP 6 – PLAN
    ========================== */
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
    },

    /* =========================
       STATUS & FLOW
    ========================== */
    stepCompleted: {
      type: Number,
      default: 1,
    },

    isDraft: {
      type: Boolean,
      default: true,
    },

    isPublished: {
      type: Boolean,
      default: false,
    },

    /* =========================
       SOFT DELETE
    ========================== */
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Listing", listingSchema);
