// models/roomSchema.js
import mongoose from "mongoose";

// ─── Sub-schema: A single bookable room / accommodation unit ──────────────────
const roomSchema = new mongoose.Schema(
  {
    /* =========================
       REFERENCES
    ========================== */
    businessListing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessListing",
      required: true,
      index: true,
    },

    categoryId : {
      type: mongoose.Schema.Types.ObjectId,
      ref: "category",
      required: true,
      index: true,
    },

    // Denormalized for fast reads — mirrors the listing's category name
    //  values match the three supported verticals
    categoryType: {
      type: String,
      enum: ["Hotel", "Hostel", "Yoga Studio"],
      required: true,
    },

    // "Shared" | "Private" — used in both hostel & yoga; for hotel: "Standard" | "Deluxe" | "Luxury"
    roomType: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // Maximum occupancy — rendered as badge2 in the frontend
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },

    images: {
      type: [String],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    /* =========================
       HOTEL-SPECIFIC FIELDS
    ========================== */
    hotel: {
      checkIn: { type: String, default: null },   // e.g. "12:00 PM"
      checkOut: { type: String, default: null },  // e.g. "11:00 AM"
    },

    /* =========================
       HOSTEL-SPECIFIC FIELDS
    ========================== */
    hostel: {
      checkIn: { type: String, default: null },
      checkOut: { type: String, default: null },
    },

    /* =========================
       YOGA STUDIO–SPECIFIC FIELDS
    ========================== */
    yoga: {
      batchSize: { type: Number, default: null },      // rendered in "Starting from" meta
      language: { type: String, default: null },       // e.g. "English", "Hindi"
      daysNights: { type: String, default: null },     // e.g. "3 Days | 2 Nights" — used as priceSuffix
      mealsIncluded: { type: Boolean, default: false },
    },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ── Indexes ────────────────────────────────────────────────────────────────────
roomSchema.index({ businessListing: 1, isDeleted: 1 });
roomSchema.index({ businessListing: 1, categoryType: 1, isActive: 1 });

export default mongoose.model("Room", roomSchema);