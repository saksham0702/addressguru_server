import mongoose from "mongoose";

const crawledPageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    statusCode: { type: Number, default: 200 },
    title: { type: String, default: "" },
    titleLength: { type: Number, default: 0 },
    metaDescription: { type: String, default: "" },
    metaDescriptionLength: { type: Number, default: 0 },
    h1: { type: String, default: "" },
    h1Count: { type: Number, default: 0 },
    headings: {
      h2Count: { type: Number, default: 0 },
      h3Count: { type: Number, default: 0 },
      hasSequentialStructure: { type: Boolean, default: true },
    },
    canonical: { type: String, default: "" },
    isCanonicalSelfReferencing: { type: Boolean, default: true },
    lang: { type: String, default: "" },
    robotsMeta: { type: String, default: "" },
    wordCount: { type: Number, default: 0 },
    responseTimeMs: { type: Number, default: 0 },
    pageSizeKb: { type: Number, default: 0 },
  },
  { _id: false }
);

const imageFindingSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    pageUrl: { type: String, default: "" },
    alt: { type: String, default: "" },
    hasAlt: { type: Boolean, default: false },
    hasDimensions: { type: Boolean, default: false },
    width: { type: String, default: "" },
    height: { type: String, default: "" },
    statusCode: { type: Number, default: 200 },
    sizeKb: { type: Number, default: 0 },
  },
  { _id: false }
);

const linkFindingSchema = new mongoose.Schema(
  {
    sourceUrl: { type: String, required: true },
    targetUrl: { type: String, required: true },
    text: { type: String, default: "" },
    hasAnchorText: { type: Boolean, default: true },
    isExternal: { type: Boolean, default: false },
    statusCode: { type: Number, default: 200 },
    isBroken: { type: Boolean, default: false },
    isRedirect: { type: Boolean, default: false },
  },
  { _id: false }
);

const issueSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    category: {
      type: String,
      enum: ["seo", "technical", "links", "images", "performance"],
      required: true,
    },
    severity: {
      type: String,
      enum: ["critical", "warning", "info"],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    recommendation: { type: String, required: true },
    pageUrl: { type: String, default: "" },
    affectedUrls: [{ type: String }],
    evidence: { type: String, default: "" },
  },
  { _id: false }
);

const passedCheckSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
  },
  { _id: false }
);

const unavailableCheckSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    title: { type: String, required: true },
    reason: { type: String, required: true },
  },
  { _id: false }
);

const websiteAuditSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    domain: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["in_progress", "completed", "failed"],
      default: "in_progress",
      index: true,
    },
    error: {
      type: String,
      default: "",
    },
    overallScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    grade: {
      type: String,
      enum: ["A", "B", "C", "D", "F"],
      default: "C",
    },
    categoryScores: {
      seo: { type: Number, default: 0, min: 0, max: 30 },
      technical: { type: Number, default: 0, min: 0, max: 25 },
      links: { type: Number, default: 0, min: 0, max: 20 },
      images: { type: Number, default: 0, min: 0, max: 15 },
      performance: { type: Number, default: 0, min: 0, max: 10 },
    },
    stats: {
      totalPagesCrawled: { type: Number, default: 0 },
      totalImages: { type: Number, default: 0 },
      totalInternalLinks: { type: Number, default: 0 },
      totalExternalLinks: { type: Number, default: 0 },
      durationMs: { type: Number, default: 0 },
      totalHtmlSizeKb: { type: Number, default: 0 },
    },
    crawledPages: [crawledPageSchema],
    imagesFindings: [imageFindingSchema],
    linksFindings: [linkFindingSchema],
    issues: [issueSchema],
    passedChecks: [passedCheckSchema],
    unavailableChecks: [unavailableCheckSchema],
  },
  {
    timestamps: true,
  }
);

// Compound index for fast user audit history queries
websiteAuditSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("WebsiteAudit", websiteAuditSchema);
