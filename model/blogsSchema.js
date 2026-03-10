import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    content: {
      type: String,
      required: true,
    },
    image: {
      type: String,
    },
    category: {
      type: String,
    },
    tags: {
      type: [String],
    },
    author: {
      type: String,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    featured: {
      type: Boolean,
      default: false,
    },
    views: {
      type: Number,
      default: 0,
    },
    seoTitle: {
      type: String,
    },
    seoDescription: {
      type: String,
    },
    seoKeywords: {
      type: [String],
    },
    relatedPosts: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Blog",
    },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlogCategory",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Blog", blogSchema);
