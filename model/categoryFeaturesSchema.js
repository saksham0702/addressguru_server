// models/Feature.js
import mongoose from "mongoose";

const featureItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const featureSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["facility", "service", "payment"],
      required: true,
      unique: true, // 🚀 ONE document per type
    },

    items: [featureItemSchema],

    isStatic: {
      type: Boolean,
      default: false,
    },

    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Feature", featureSchema);
