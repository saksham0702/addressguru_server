// routes/listingFeatures.routes.js
import express from "express";

import {
  sendEnquiry,
  getEnquiries,
  getMyLeads,
  getMyLeadsStats,
  updateEnquiryStatus,
} from "../controller/enquiryListing.Controller.js";
import { authenticate } from "../middleware/userAuth.js";

import {
  submitClaim,
  getClaimStatus,
  adminListClaims,
  adminReviewClaim,
  getMyClaims,
} from "../controller/claimListing.Controller.js";

import {
  getReportReasons,
  submitReport,
  adminListReports,
  adminReviewReport,
  getMyReports,
} from "../controller/reportListing.Controller.js";

import {
  submitReview,
  getReviews,
  getMyReviews,
  getMyReviewsStats,
  adminReviewAction,
  deleteReview,
} from "../controller/reviewListing.Controller.js";
import upload from "../middleware/multerConfig.js";

const router = express.Router();

/*
  All listing-scoped routes use this param pattern:
    :type  → business | job | property | marketplace
    :slug  → listing slug OR 24-char ObjectId

  Examples:
    POST /api/business/achievers-dream-chemistry/enquiry
    POST /api/job/senior-developer-karachi/review
    POST /api/property/3bhk-flat-lahore-gulberg/claim
*/

// ════════════════════════════════════════════════════════════════
//  ENQUIRY  (Contact / Get More Info form)
// ════════════════════════════════════════════════════════════════

// Send enquiry to listing owner
router.post("/:type/:slug/enquiry", sendEnquiry);

// List enquiries for a listing  (owner / admin)
router.get("/:type/:slug/enquiries", getEnquiries);

// List all leads for current owner (Dashboard)
router.get("/my-leads", authenticate, getMyLeads);

// List stats for filter (Dashboard)
router.get("/my-leads/stats", authenticate, getMyLeadsStats);

// Mark enquiry as read / replied
router.patch("/enquiries/:enquiryId", updateEnquiryStatus);

// ════════════════════════════════════════════════════════════════
//  CLAIM BUSINESS  (Listing ownership claim)
// ════════════════════════════════════════════════════════════════

// Submit a claim
router.post(
  "/:type/:slug/claim",
  (req, res, next) => {
    req._uploadFolder = "claims"; // custom folder name
    next();
  },
  upload.single("idProofImage"), // 👈 important (field name must match frontend)
  submitClaim,
);
// Get current claim status for a listing
router.get("/:type/:slug/claim", getClaimStatus);

// My claims (dashboard)
router.get("/my-claims", authenticate, getMyClaims);

// Admin: list all claims
router.get("/admin/claims", adminListClaims);

// Admin: approve or reject a claim
router.patch("/admin/claims/:claimId", adminReviewClaim);

// ════════════════════════════════════════════════════════════════
//  REPORT AD  (Listing content violation report)
// ════════════════════════════════════════════════════════════════

// Get all valid report reasons (for frontend radio list)
router.get("/report-reasons", getReportReasons);

// Submit a report
router.post("/:type/:slug/report", submitReport);

// My reports (dashboard)
router.get("/my-reports", authenticate, getMyReports);

// Admin: list all reports
router.get("/admin/reports", adminListReports);

// Admin: review a report
router.patch("/admin/reports/:reportId", adminReviewReport);

// ════════════════════════════════════════════════════════════════
//  REVIEWS & RATING  (Listing reviews and star ratings)
// ════════════════════════════════════════════════════════════════

// Submit a review
router.post("/:type/:slug/review", submitReview);

// Get all reviews + rating stats for a listing
router.get("/:type/:slug/reviews", getReviews);

// Dashboard: list all reviews for owner's listings
router.get("/my-reviews", authenticate, getMyReviews);

// Dashboard: get stats for owner's reviews
router.get("/my-reviews/stats", authenticate, getMyReviewsStats);

// Admin: approve / reject a review
router.patch("/admin/reviews/:reviewId", adminReviewAction);

// Delete a review (admin / owner)
router.delete("/:type/:slug/reviews/:reviewId", deleteReview);

export default router;
