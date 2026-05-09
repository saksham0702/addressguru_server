import mongoose from "mongoose";

const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },

  answer: {
    type: String,
    required: true,
  },
});

const seoContentSchema = new mongoose.Schema(
  {
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    city_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City",
      required: true,
    },

    // SECTION 1
    city_content: {
      type: String,
      required: true,
    },

    // SECTION 2
    seo_content: {
      type: String,
      default: "",
    },

    // SECTION 3
    pricing_content: {
      type: String,
      default: "",
    },

    // SECTION 4
    faq_content: [faqSchema],

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

seoContentSchema.index(
  { category_id: 1, city_id: 1 },
  {
    unique: true,
  },
);

export default mongoose.model("SeoContent", seoContentSchema);
