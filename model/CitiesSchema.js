import mongoose from "mongoose";

const citySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["state", "city", "locality"],
      default: "city",
    },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City",
      default: null,
      index: true,
    },

    status: {
      type: Boolean,
      default: true,
    },

    added_by: String,

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "cities",
  },
);

// Prevent duplicate locality/city under the SAME parent.
// Deleted records don't count.
citySchema.index(
  { parent: 1, type: 1, slug: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
    },
  },
);

export default mongoose.model("City", citySchema);
