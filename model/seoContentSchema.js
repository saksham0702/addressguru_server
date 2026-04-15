import mongoose from "mongoose";

const seoContentSchema = new mongoose.Schema(
  {
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    city_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "City",
      },
    ], // empty array = default for all cities

    title: String,

    content: {
      type: String,
      required: true,
    },

    meta_title: String,
    meta_description: String,

    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Prevent duplicate entries

export default mongoose.model("SeoContent", seoContentSchema);
