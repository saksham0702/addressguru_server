import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // PLAN

    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },

    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessListing",
      default: null,
    },

    planSnapshot: {
      name: {
        type: String,
        default: null,
      },

      slug: {
        type: String,
        default: null,
      },

      price: {
        type: Number,
        default: 0,
      },

      billingCycle: {
        type: String,
        default: null,
      },

      features: {
        type: [String],
        default: [],
      },
    },

    // PAYMENT
    amount: {
      type: Number,
      required: true,
    },

    amountInSubunits: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "AED",
    },

    status: {
      type: String,

      enum: ["created", "authorized", "captured", "failed", "cancelled"],

      default: "created",

      index: true,
    },

    razorpay: {
      orderId: {
        type: String,
        sparse: true,
        required: function () {
          return this.parent().amount > 0;
        },
      },

      paymentId: {
        type: String,
        default: null,
        index: true,
      },

      signature: {
        type: String,
        default: null,
      },

      method: {
        type: String,
        default: null,
      },

      international: {
        type: Boolean,
        default: false,
      },

      email: {
        type: String,
        default: null,
      },

      contact: {
        type: String,
        default: null,
      },
    },

    paidAt: {
      type: Date,
      default: null,
    },

    failedAt: {
      type: Date,
      default: null,
    },

    failureReason: {
      type: String,
      default: null,
    },

    receipt: {
      type: String,
      sparse: true,
      required: function () {
        return this.amount > 0;
      },
    },

    webhookEvent: {
      type: String,
      default: null,
    },

    notes: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

paymentSchema.index({
  user: 1,
  status: 1,
});

export default mongoose.model("Payment", paymentSchema);
