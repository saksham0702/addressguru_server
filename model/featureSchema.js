// models/Feature.js
import mongoose from "mongoose";

const featureSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true },

    type: {
      type: String,
      enum: ["facility", "service", "course", "payment_mode"],
      required: true,
    },

    iconSvg: String,

    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model("Feature", featureSchema);
