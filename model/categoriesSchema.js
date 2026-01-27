// models/Category.js
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true },

    description: String,

    type: {
      type: String,
      enum: ["business", "marketplace", "job", "property"],
    },

    color: String,
    textColor: String,

    iconSvg: String,
    iconPng: String,

    seo: {
      title: String,
      description: String,
    },

    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model("Category", categorySchema);
