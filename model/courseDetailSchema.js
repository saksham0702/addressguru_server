import mongoose from "mongoose";

const courseDetailSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "businesslistings",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "categories",
      required: true,
    },
    courseName: {
      type: String,
      required: true,
    },
    duration: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Avoid duplicates for same combo
courseDetailSchema.index(
  { feature: 1, listing: 1, category: 1 },
  { unique: true },
);

export default mongoose.model("CourseDetail", courseDetailSchema);
