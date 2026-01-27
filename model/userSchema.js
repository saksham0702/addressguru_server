import mongoose from "mongoose";
import { ROLES } from "../services/constant.js";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
      note: "User email address",
    },

    phone: {
      type: String,
      unique: true,
      sparse: true, // allows multiple docs without phone
      note: "Optional phone number",
    },

    whatsapp_same: {
      type: Boolean,
      default: false,
      note: "Indicates if user's phone number is same as WhatsApp number",
    },

    password: {
      type: String,
      // required: true,
      note: "Hashed password",
    },

    name: {
      type: String,
      trim: true,
    },

    avatar: {
      type: String,
      note: "Profile image URL",
    },

    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
      note: "user(Vendor), BDE(Editor), admin, listPartner(Agent)",
    },

    permission: {
      type: String,
    },

    city: {
      type: String,
    },

    login_type: {
      type: String,
      enum: ["google", "apple", "email"],
      default: "email",
    },

    provider: {
      type: String,
      enum: ["google", "apple"],
    },

    providerId: {
      type: String,
    },

    refreshTokenEncrypted: {
      type: String,
    },

    verified_email: {
      type: Boolean,
      default: false,
    },

    verified_phone: {
      type: Boolean,
      default: false,
    },

    otp: { type: String },
    otpCreatedAt: { type: Date },

    profile_bio: {
      type: String,
    },
    profile_website: {
      type: String,
    },
    profile_location_emirate: {
      type: String,
    },
    profile_location_area: {
      type: String,
    },
    profile_location_coordinates: {
      type: [Number], // [longitude, latitude]
      index: "2dsphere",
      note: "Geolocation for map search",
    },

    membership_type: {
      type: String,
      enum: ["free", "premium", "featured"],
      default: "free",
    },
    membership_expiresAt: {
      type: Date,
    },

    // --- Statistics ---
    statistics_totalListings: { type: Number, default: 0 },
    statistics_ProductListings: { type: Number, default: 0 },
    statistics_marketPlaceListings: { type: Number, default: 0 },
    statistics_JobsListings: { type: Number, default: 0 },
    statistics_PropertiesListings: { type: Number, default: 0 },
    statistics_totalViews: { type: Number, default: 0 },
    statistics_totalCalls: { type: Number, default: 0 },
    statistics_totalLeads: { type: Number, default: 0 },
    statistics_totalReviews: { type: Number, default: 0 },
    statistics_totalWebsiteVisits: { type: Number, default: 0 },
    statistics_rating: { type: Number, default: 0 },
    statistics_activeListings: { type: Number, default: 0 },
    statistics_soldItems: { type: Number, default: 0 },

    // --- Preferences ---
    preferences_notifications_email: { type: Boolean, default: true },
    preferences_notifications_sms: { type: Boolean, default: false },
    preferences_notifications_push: { type: Boolean, default: true },
    preferences_language: { type: String, default: "en" },

    // --- Login Info ---
    login_ipaddress: { type: String },
    login_browser: { type: String },

    // --- Status ---
    status: { type: Boolean, default: true },
    lastActive: { type: Date, default: Date.now },

    // --- Timestamps ---
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
    collection: "users",
  }
);

export default mongoose.model("User", userSchema);
