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
    hasSubCategories: {
      type: Boolean,
      default: false,
    },

    // NEW
    tags: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],

    color: String,
    textColor: String,

    iconSvg: String,
    iconPng: String,

    seo: {
      title: String,
      description: String,
      ogImage: String,
    },

    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);


categorySchema.index({ slug: 1 });

categorySchema.index({
  name: "text",
  tags: "text",
});

export default mongoose.model("Category", categorySchema);