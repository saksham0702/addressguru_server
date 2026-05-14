// modules/payment/payment.schema.js

import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    listingType: {
      type: String,
      enum: ["BUSINESS", "MARKETPLACE", "PROPERTIES", "JOBS"],
    },

    listingId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
    },

    amount: Number,
    currency: { type: String, default: "AED" },

    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },

    paymentProvider: {
      type: String,
      enum: ["RAZORPAY", "STRIPE", "NONE"],
      default: "NONE",
    },

    transactionId: String, // from gateway later

    meta: {
      type: Object, // raw gateway response later
      default: {},
    },
  },
  { timestamps: true },
);

export default mongoose.model("Payment", paymentSchema);
