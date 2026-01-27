import mongoose from "mongoose";

const citySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
    added_by: {
      type: String,
      note: "User ID or name who added the city",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "cities",
  }
);

export default mongoose.model("City", citySchema);
