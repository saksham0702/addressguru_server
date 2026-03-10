// models/CategoryFeature.js
import mongoose from "mongoose";

const categoryFeatureSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
    },

    facilities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Feature" }],
    services: [{ type: mongoose.Schema.Types.ObjectId, ref: "Feature" }],
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Feature" }],
    payment_modes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Feature" }],
  },
  { timestamps: true },
);

// One pivot doc per category
categoryFeatureSchema.index({ category: 1, subcategory: 1 }, { unique: true });

export default mongoose.model("CategoryFeature", categoryFeatureSchema);
