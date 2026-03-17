// routes/jobApplicationRoutes.js
import express from "express";
import {
  applyForJob,
  getApplicationsByJob,
  getApplicationById,
  updateApplicationStatus,
  withdrawApplication,
  getMyApplications,
  deleteApplication,
  getApplicationStats,
} from "../controller/jobApplicationController.js";

import { handleResumeUpload, uploadResume } from "../middleware/resumeUpload.js";
import { authenticate, optionalAuth } from "../middleware/userAuth.js";
import upload from "../middleware/multerConfig.js";

const router = express.Router();

/* ──────────────────────────────────────────────────────────
   PUBLIC / OPTIONAL-AUTH
────────────────────────────────────────────────────────── */

// Apply for a job  (auth optional — guests can apply via email)
// POST /api/applications/:slug/apply
router.post(
  "/:slug/apply",
  optionalAuth,           // sets req.user if token present, else null
  upload.single("resume"), // handle file upload (field name = "resume")
  applyForJob
);

/* ──────────────────────────────────────────────────────────
   AUTHENTICATED USER ROUTES
────────────────────────────────────────────────────────── */

// Get logged-in user's own applications
// GET /api/applications/my?page=1&limit=10&status=pending
router.get("/my", authenticate, getMyApplications);

// Withdraw own application
// PATCH /api/applications/:applicationId/withdraw
router.patch("/:applicationId/withdraw", authenticate, withdrawApplication);

/* ──────────────────────────────────────────────────────────
   ADMIN / JOB-OWNER ROUTES
────────────────────────────────────────────────────────── */

// Get all applications for a job
// GET /api/applications/:slug?page=1&limit=10&status=pending&search=john
router.get("/:slug", authenticate, getApplicationsByJob);

// Get application stats for a job
// GET /api/applications/:slug/stats
router.get("/:slug/stats", authenticate, getApplicationStats);

// Get single application by ID
// GET /api/applications/detail/:applicationId
router.get("/detail/:applicationId", authenticate, getApplicationById);

// Update application status (admin / owner)
// PATCH /api/applications/:applicationId/status
router.patch("/:applicationId/status", authenticate, updateApplicationStatus);

// Soft delete application (admin only)
// DELETE /api/applications/:applicationId
router.delete("/:applicationId", authenticate, deleteApplication);

export default router;
