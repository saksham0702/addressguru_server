import mongoose from "mongoose";
import { VALID_ROLES, ROLES } from "../services/constant.js";

const userSchema = new mongoose.Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    name: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      unique: true,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },

    phone: {
      type: String,
      unique: true,
      sparse: true, // allows multiple docs without phone
    },

    whatsapp_same: {
      type: Boolean,
      default: false,
    },

    password: {
      type: String,
      // not required — social login users won't have one
    },

    avatar: {
      type: String,
    },

    // ── Role & Permissions ────────────────────────────────────────────────────
    /**
     * Numeric role hierarchy:
     *   1 = Admin  (highest authority)
     *   2 = Editor
     *   3 = Agent
     *   4 = BDE
     *   5 = User   (lowest authority)
     */
    roles: {
      type: [Number],
      enum: VALID_ROLES,
      default: [ROLES.USER],
    },

    /**
     * Fine-grained permission string or JSON blob.
     * Only relevant for non-admin staff accounts created by admin.
     * e.g. "listings:read,listings:write"
     */
    permission: {
      type: [String],
      default: null,
    },

    city: {
      type: String,
    },

    // ── Auth / Login ──────────────────────────────────────────────────────────
    login_type: {
      type: String,
      enum: ["google", "apple", "email"],
      default: "email",
    },

    provider: {
      type: String,
      enum: ["google", "apple", null],
      default: null,
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

    otp: { type: String, default: null },
    otpCreatedAt: { type: Date, default: null },

    // ── Profile ───────────────────────────────────────────────────────────────
    profile_bio: { type: String },
    profile_website: { type: String },
    profile_location_emirate: { type: String },
    profile_location_area: { type: String },
    profile_location_coordinates: {
      type: [Number], // [longitude, latitude]
      index: "2dsphere",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },

    // ── Membership ────────────────────────────────────────────────────────────
    membership_type: {
      type: String,
      enum: ["free", "premium", "featured"],
      default: "free",
    },
    membership_expiresAt: { type: Date },

    // ── Statistics ────────────────────────────────────────────────────────────
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

    // ── Preferences ───────────────────────────────────────────────────────────
    preferences_notifications_email: { type: Boolean, default: true },
    preferences_notifications_sms: { type: Boolean, default: false },
    preferences_notifications_push: { type: Boolean, default: true },
    preferences_language: { type: String, default: "en" },

    // ── Login Meta ────────────────────────────────────────────────────────────
    login_ipaddress: { type: String },
    login_browser: { type: String },

    // ── Flags ─────────────────────────────────────────────────────────────────
    status: { type: Boolean, default: true },
    lastActive: { type: Date, default: Date.now },

    // Soft-delete
    deletedAt: { type: Date, default: null },

    // Who created this account (for admin-created staff accounts)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "users",
  },
);

export default mongoose.model("User", userSchema);
