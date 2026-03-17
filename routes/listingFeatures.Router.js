// routes/listingFeatures.routes.js
import express from "express";

import {
  sendEnquiry,
  getEnquiries,
  updateEnquiryStatus,
} from "../controller/enquiryListing.Controller.js";

import {
  submitClaim,
  getClaimStatus,
  adminListClaims,
  adminReviewClaim,
} from "../controller/claimListing.Controller.js";

import {
  getReportReasons,
  submitReport,
  adminListReports,
  adminReviewReport,
} from "../controller/reportListing.Controller.js";

import {
  submitReview,
  getReviews,
  adminReviewAction,
  deleteReview,
} from "../controller/reviewListing.Controller.js";

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

// Mark enquiry as read / replied
router.patch("/enquiries/:enquiryId", updateEnquiryStatus);

// ════════════════════════════════════════════════════════════════
//  CLAIM BUSINESS  (Listing ownership claim)
// ════════════════════════════════════════════════════════════════

// Submit a claim
router.post("/:type/:slug/claim", submitClaim);

// Get current claim status for a listing
router.get("/:type/:slug/claim", getClaimStatus);

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

// Admin: approve / reject a review
router.patch("/admin/reviews/:reviewId", adminReviewAction);

// Delete a review (admin / owner)
router.delete("/:type/:slug/reviews/:reviewId", deleteReview);

export default router;