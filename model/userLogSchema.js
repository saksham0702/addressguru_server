import mongoose from "mongoose";

const userLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      note: "User reference",
      index: true,
    },

    ipAddress: {
      type: String,
      required: true,
      note: "User IP address",
    },
    location_coordinates: {
      type: [Number], // [longitude, latitude]
      index: "2dsphere",
      note: "GeoJSON coordinates for location tracking",
    },

    device_type: {
      type: String,
      enum: ["Desktop", "Mobile", "Tablet", "Other"],
      default: "Other",
      note: "Device category",
    },
    device_os: { type: String },
    device_browser: { type: String },
    device_browserVersion: { type: String },
    device_userAgent: { type: String },

    network_isp: { type: String },
    network_proxy: { type: Boolean, default: false },

    session_loginAt: { type: Date, default: Date.now },
    session_logoutAt: { type: Date, default: null },
    session_lastActiveAt: { type: Date, default: Date.now },

    type: {
      type: String,
      enum: ["login", "signup", "activity"],
      default: "login",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "user_logs",
  }
);

export default mongoose.model("UserLog", userLogSchema);
