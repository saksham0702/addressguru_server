// models/jobApplicationSchema.js
import mongoose from "mongoose";

const jobApplicationSchema = new mongoose.Schema(
  {
    // ─── Core References ──────────────────────────────────────
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null = guest applicant
    },

    // ─── Applicant Info (guest or pre-filled) ─────────────────
    fullName: { type: String, required: true, trim: true },
    email:    { type: String, required: true, trim: true, lowercase: true },
    phone:    { type: String, trim: true },
    whatsapp: { type: String, trim: true },

    // ─── Professional Info ────────────────────────────────────
    coverLetter:      { type: String, default: null },
    expectedSalary:   { type: Number, default: null },
    availableFrom:    { type: Date,   default: null },

    currentJobTitle:  { type: String, default: null },
    currentCompany:   { type: String, default: null },
    totalExperience:  { type: Number, default: null }, // in years

    // ─── Links ────────────────────────────────────────────────
    portfolioUrl:  { type: String, default: null },
    linkedinUrl:   { type: String, default: null },
    githubUrl:     { type: String, default: null },

    // ─── Resume / CV ──────────────────────────────────────────
    resume: {
      url:          { type: String, default: null }, // uploaded file path
      originalName: { type: String, default: null },
    },

    // ─── Status & Pipeline ────────────────────────────────────
    status: {
      type: String,
      enum: [
        "pending",       // just submitted
        "reviewing",     // HR opened/reviewed
        "shortlisted",   // moved forward
        "interview",     // interview scheduled
        "offered",       // offer sent
        "hired",         // hired
        "rejected",      // rejected
        "withdrawn",     // applicant pulled out
      ],
      default: "pending",
    },

    // Internal notes by admin/HR
    adminNote: { type: String, default: null },

    // ─── Source ───────────────────────────────────────────────
    source: {
      type: String,
      enum: ["website", "referral", "email", "whatsapp", "other"],
      default: "website",
    },

    // ─── Flags ────────────────────────────────────────────────
    isRead:    { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ─── Prevent duplicate applications ──────────────────────────
jobApplicationSchema.index(
  { job: 1, email: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);

// ─── Performance indexes ──────────────────────────────────────
jobApplicationSchema.index({ job: 1, status: 1 });
jobApplicationSchema.index({ applicant: 1 });
jobApplicationSchema.index({ status: 1 });
jobApplicationSchema.index({ isDeleted: 1 });
jobApplicationSchema.index({ createdAt: -1 });

export default mongoose.model("JobApplication", jobApplicationSchema);
