// models/blog.model.js
import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    content: { type: String, required: true }, // raw HTML from editor
    excerpt: { type: String, maxlength: 300 },
    coverImage: { type: String }, // path from multer

    category_id: { type: mongoose.Schema.Types.ObjectId, ref: "BlogCategory" },
    tags: { type: [String], default: [] },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["draft", "published", "rejected"],
      default: "draft",
    },

    rejectionReason: {
      type: String,
      default: null,
    },

    publishedAt: { type: Date },
    featured: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    readingTime: { type: Number, default: 0 },

    seo: {
      title: { type: String },
      description: { type: String, maxlength: 160 },
      keywords: { type: [String], default: [] },
      ogImage: { type: String },
    },

    relatedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Blog" }],
  },
  { timestamps: true },
);

// Indexes
blogSchema.index({ slug: 1 });
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ author: 1 });
blogSchema.index({ category_id: 1 });
blogSchema.index({ featured: 1, publishedAt: -1 });
blogSchema.index({ views: -1 });

// Auto reading time
blogSchema.pre("save", function (next) {
  if (this.isModified("content")) {
    const words = this.content
      .replace(/<[^>]+>/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    this.readingTime = Math.max(1, Math.ceil(words / 200));
  }
  next();
});

// Auto publishedAt
blogSchema.pre("save", function (next) {
  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }
  next();
});

// Default seo.ogImage to coverImage
blogSchema.pre("save", function (next) {
  if (this.coverImage && !this.seo?.ogImage) {
    this.seo.ogImage = this.coverImage;
  }
  next();
});

export default mongoose.model("Blog", blogSchema);
