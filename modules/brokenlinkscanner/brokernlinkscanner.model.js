import mongoose from "mongoose";

const brokenLinkScannerSchema = new mongoose.Schema(
  {
    sourcePage: {
      type: String,
      required: true,
      index: true,
    },

    brokenLink: {
      type: String,
      required: true,
    },

    statusCode: {
      type: Number,
      default: 0,
    },

    error: {
      type: String,
      default: "",
    },

    checkedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("BrokenLinkScanner", brokenLinkScannerSchema);
