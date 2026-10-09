import ClaimBusiness from "../../model/claimBusinessSchema.js";
import BusinessListing from "../../model/businessListingSchema.js";
import JobsListing from "../../model/jobsListingSchema.js";
import MarketplaceListing from "../../model/marketplaceListingSchema.js";
import PropertiesListing from "../../model/propertiesListingSchema.js";
import ListingEnquiry from "../../model/listingEnquirySchema.js";
import ReviewListing from "../../model/reviewListingSchema.js";
import User from "../../model/userSchema.js";

/**
 * GET /admin-notifications/badge-counts
 * Returns count of pending actionable items for admin sidebar badges
 */
export const getAdminBadgeCounts = async (req, res) => {
  try {
    const since24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      pendingClaims,
      pendingBusiness,
      pendingJobs,
      pendingMarketplace,
      pendingProperty,
      pendingReviews,
      totalEnquiries,
      onlineUsers,
    ] = await Promise.all([
      ClaimBusiness.countDocuments({
        createdAt: { $gte: since24Hours },
        isDeleted: false,
      }).catch(() => 0),
      BusinessListing.countDocuments({
        createdAt: { $gte: since24Hours },
        isDeleted: false,
      }).catch(() => 0),
      JobsListing.countDocuments({
        createdAt: { $gte: since24Hours },
        isDeleted: false,
      }).catch(() => 0),
      MarketplaceListing.countDocuments({
        createdAt: { $gte: since24Hours },
        isDeleted: false,
      }).catch(() => 0),
      PropertiesListing.countDocuments({
        createdAt: { $gte: since24Hours },
        isDeleted: false,
      }).catch(() => 0),
      ReviewListing.countDocuments({
        createdAt: { $gte: since24Hours },
        isDeleted: false,
      }).catch(() => 0),
      ListingEnquiry.countDocuments({
        createdAt: { $gte: since24Hours },
        isDeleted: false,
      }).catch(() => 0),
      User.countDocuments({ isOnline: true }).catch(() => 0),
    ]);

    const listingsTotal =
      pendingBusiness + pendingJobs + pendingMarketplace + pendingProperty;
    const engagementTotal = pendingClaims + pendingReviews;

    return res.status(200).json({
      success: true,
      data: {
        claims: pendingClaims,
        businessListings: pendingBusiness,
        jobsListings: pendingJobs,
        marketplaceListings: pendingMarketplace,
        propertyListings: pendingProperty,
        listingsTotal,
        reviews: pendingReviews,
        engagementTotal,
        leads: totalEnquiries,
        onlineUsers,
      },
    });
  } catch (error) {
    console.error("getAdminBadgeCounts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin badge counts",
      error: error.message,
    });
  }
};
