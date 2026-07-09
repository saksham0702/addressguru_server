// brokenlinkscanner.progress.model.js
import mongoose from "mongoose";

const progressSchema = new mongoose.Schema({
  key: { type: String, default: "brokenLinkScanCursor", unique: true },
  cursor: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("BrokenLinkScanProgress", progressSchema);
