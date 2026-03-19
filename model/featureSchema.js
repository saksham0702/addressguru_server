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

featureSchema.index({ type: 1, isActive: 1 });

featureSchema.index({ name: 1, type: 1 });

featureSchema.index({ slug: 1 });

featureSchema.index({ isDeleted: 1 });
  
featureSchema.index({ createdAt: 1 });

featureSchema.index({ updatedAt: 1 });
