// models/jobSchema.js
import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    // ─── Core Info ───────────────────────────────────────────
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      default: null,
    },

    // ─── Job Details ─────────────────────────────────────────
    description: { type: String }, // full job description / landing page content
    requirements: [{ type: String }], // ["2 years experience", "Bachelor's degree"]
    responsibilities: [{ type: String }], // ["Manage team", "Report to CEO"]
    benefits: [{ type: String }], // ["Health insurance", "Remote work"]

    skills: [{ type: String }],

    // ─── Sector & Type ───────────────────────────────────────
    sector: {
      type: String,
      enum: [
        "it",
        "commerce",
        "finance",
        "healthcare",
        "education",
        "engineering",
        "marketing",
        "legal",
        "hospitality",
        "construction",
        "media",
        "ngo",
        "government",
        "other",
      ],
      required: true,
    },

    jobType: {
      type: String,
      enum: [
        "full-time",
        "part-time",
        "contract",
        "freelance",
        "internship",
        "temporary",
      ],
      required: true,
    },

    workMode: {
      type: String,
      enum: ["on-site", "remote", "hybrid"],
      default: "on-site",
    },

    experienceLevel: {
      type: String,
      enum: ["entry", "junior", "mid", "senior", "lead", "executive"],
      required: true,
    },

    // ─── Salary (for filter: from/to) ────────────────────────
    salary: {
      from: { type: Number, default: null }, // min salary
      to: { type: Number, default: null }, // max salary
      currency: { type: String, default: "PKR" },
      period: {
        type: String,
        enum: ["monthly", "yearly", "weekly", "daily", "hourly"],
        default: "monthly",
      },
      isNegotiable: { type: Boolean, default: false },
      isHidden: { type: Boolean, default: false }, // show "Confidential" on frontend
    },

    // ─── Location (for filter) ───────────────────────────────
    location: {
      country: { type: String, default: "" },

      city: {
        _id: { type: mongoose.Schema.Types.ObjectId },
        name: { type: String },
        slug: { type: String }
      },

      area: { type: String },
      address: { type: String },
      isRemote: { type: Boolean, default: false },
    },

    // ─── Education & Experience (for filter) ─────────────────
    education: {
      type: String,
      enum: [
        "none",
        "matric",
        "intermediate",
        "bachelor",
        "master",
        "phd",
        "any",
      ],
      default: "any",
    },

    noOfExperience: { type: String, default: "" }, // e.g., "2 years", "1-3 years"

    // ─── Gender & Age Preference (for filter) ────────────────
    gender: {
      type: String,
      enum: ["male", "female", "any"],
      default: "any",
    },

    ageRange: {
      from: { type: Number, default: null },
      to: { type: Number, default: null },
    },

    // ─── Nationality & Language (for filter) ─────────────────
    nationality: [{ type: String }], // e.g., ["indian", "pakistani", "any"]
    language: [{ type: String }],    // e.g., ["english", "arabic"]

    // ─── Contact Info ─────────────────────────────────────────
    contact: {
      name: { type: String },
      email: { type: String },
      countryCode: { type: String },
      phone: { type: String },
      whatsapp: { type: String },
      website: { type: String }, // apply via external link
      applyEmail: { type: String }, // dedicated apply email (can differ from contact)
    },

    // ─── Company Info ─────────────────────────────────────────
    company: {
      name: { type: String },
      logo: { type: String }, // image URL
      website: { type: String },
      description: { type: String },
      size: {
        type: String,
        enum: ["1-10", "11-50", "51-200", "201-500", "500+"],
      },
      address: { type: String },
      city: {
        _id: { type: mongoose.Schema.Types.ObjectId },
        name: { type: String },
        slug: { type: String }
      },
    },

    // ─── Media ───────────────────────────────────────────────
    images: [{ type: String }], // job post banner / gallery images (relative URL paths)

    // ─── Posting Meta ─────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // required: true,
    },

    provider: {
      type: String,
      enum: ["google", "user"],
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    rejectionReason: {
      type: String,
      default: null,
    },

    totalPositions: { type: Number, default: 1 },

    applicationDeadline: { type: Date, default: null },

    availableStatus: {
      type: String,
      enum: ["open", "closed", "expired", "pending"],
      default: "open",
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "unapproved"],
      default: "pending",
    },

    isFeatured: { type: Boolean, default: false },
    isUrgent: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
    stepCompleted: { type: Number, default: 1 },

    // ─── SEO ──────────────────────────────────────────────────
    seo: {
      title: { type: String },
      description: { type: String },
      keywords: [{ type: String }],
    },

    // ─── Stats ────────────────────────────────────────────────
    views: { type: Number, default: 0 },
    applications: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// ─── Indexes for Filter Performance ───────────────────────────
jobSchema.index({ "salary.from": 1, "salary.to": 1 });
jobSchema.index({ "location.city": 1 });
jobSchema.index({ sector: 1 });
jobSchema.index({ jobType: 1 });
jobSchema.index({ workMode: 1 });
jobSchema.index({ experienceLevel: 1 });
jobSchema.index({ education: 1 });
jobSchema.index({ skills: 1 });
jobSchema.index({ gender: 1 });
jobSchema.index({ status: 1, isDeleted: 1, isActive: 1 });
jobSchema.index({ category: 1, subCategory: 1 });
jobSchema.index({ isFeatured: 1, isUrgent: 1 });
jobSchema.index({ applicationDeadline: 1 });
jobSchema.index({ slug: 1 });

export default mongoose.model("Job", jobSchema);
