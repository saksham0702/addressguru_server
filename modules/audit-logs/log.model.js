import mongoose from "mongoose";

const logSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    role: String,

    module: {
      type: String,
      index: true,
    },

    action: String,

    method: {
      type: String,
      index: true,
    },

    endpoint: {
      type: String,
      index: true,
    },

    statusCode: {
      type: Number,
      index: true,
    },

    responseTime: Number,

    ip: {
      type: String,
      index: true,
    },

    browser: String,

    browserVersion: String,

    os: {
      type: String,
      index: true,
    },

    osVersion: String,

    device: String,

    cpu: String,

    userAgent: String,

    query: Object,

    params: Object,

    body: Object,

    response: Object,

    error: Object,

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  },
);

export default mongoose.model("Log", logSchema);
