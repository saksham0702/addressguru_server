import mongoose from "mongoose";
import { successData, errorData } from "../services/helper.js";

/**
 * Get comprehensive admin platform statistics
 * GET /api/v1/admin/statistics
 */
export const getAdminStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const last7Days = new Date(today);
    last7Days.setDate(today.getDate() - 7);
    last7Days.setHours(0, 0, 0, 0);

    const last30Days = new Date(today);
    last30Days.setDate(today.getDate() - 30);
    last30Days.setHours(0, 0, 0, 0);

    // ─── Helper: count docs ──────────────────────────────────────────────────
    const count = (model, filter = {}) =>
      mongoose.model(model).countDocuments(filter);

    // ─── 1. USERS ────────────────────────────────────────────────────────────
    const [
      totalUsers,
      activeUsers,
      newUsersLast7Days,
      newUsersLast30Days,
    ] = await Promise.all([
      count("User", { isDeleted: false }),
      count("User", { isDeleted: false, isActive: true }),
      count("User", { isDeleted: false, createdAt: { $gte: last7Days } }),
      count("User", { isDeleted: false, createdAt: { $gte: last30Days } }),
    ]);

    // ─── 2. LISTINGS ─────────────────────────────────────────────────────────
    const [
      totalBusiness,
      activeBusiness,
      newBusinessLast30Days,
      totalJobs,
      activeJobs,
      newJobsLast30Days,
      totalProperties,
      activeProperties,
      newPropertiesLast30Days,
      totalMarketplace,
      activeMarketplace,
      newMarketplaceLast30Days,
    ] = await Promise.all([
      count("BusinessListing", { isDeleted: false }),
      count("BusinessListing", { isDeleted: false, status: "active" }),
      count("BusinessListing", { isDeleted: false, createdAt: { $gte: last30Days } }),

      count("Job", { isDeleted: false }),
      count("Job", { isDeleted: false, status: "active" }),
      count("Job", { isDeleted: false, createdAt: { $gte: last30Days } }),

      count("PropertyListing", { isDeleted: false }),
      count("PropertyListing", { isDeleted: false, status: "active" }),
      count("PropertyListing", { isDeleted: false, createdAt: { $gte: last30Days } }),

      count("MarketplaceListing", { isDeleted: false }),
      count("MarketplaceListing", { isDeleted: false, status: "active" }),
      count("MarketplaceListing", { isDeleted: false, createdAt: { $gte: last30Days } }),
    ]);

    // ─── 3. ENGAGEMENT ───────────────────────────────────────────────────────
    const [
      totalJobApplications,
      newApplicationsLast7Days,
      totalListingEnquiries,
      newEnquiriesLast7Days,
      totalFollowUps,
      pendingFollowUps,
      totalReviews,
      pendingReviews,
      totalClaimRequests,
      pendingClaimRequests,
      totalReportedListings,
      pendingReports,
    ] = await Promise.all([
      count("JobApplication"),
      count("JobApplication", { createdAt: { $gte: last7Days } }),

      count("ListingEnquiry"),
      count("ListingEnquiry", { createdAt: { $gte: last7Days } }),

      count("FollowUp"),
      count("FollowUp", { status: "pending" }),

      count("ReviewListing"),
      count("ReviewListing", { status: "pending" }),

      count("ClaimBusiness"),
      count("ClaimBusiness", { status: "pending" }),

      count("ReportedListing"),
      count("ReportedListing", { status: "pending" }),
    ]);

    // ─── 4. CATALOGUE ────────────────────────────────────────────────────────
    const [
      totalCategories,
      totalSubcategories,
      totalCategoryFeatures,
      totalFeatures,
      totalCities,
      totalPlans,
      totalTemplates,
    ] = await Promise.all([
      count("Category"),
      count("SubCategory"),
      count("CategoryFeature"),
      count("Feature"),
      count("City"),
      count("Plan"),
      count("Template"),
    ]);

    // ─── 5. LISTING STATS (events) ───────────────────────────────────────────
    const eventAgg = await mongoose.model("ListingStats").aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);
    const events = { view: 0, call: 0, lead: 0, website_visit: 0, review: 0 };
    eventAgg.forEach((e) => { if (e._id in events) events[e._id] = e.count; });

    // ─── 6. GOOGLE LISTINGS ──────────────────────────────────────────────────
    const [totalGoogleListings, claimedGoogleListings] = await Promise.all([
      count("GoogleListing"),
      count("GoogleListing", { isClaimed: true }),
    ]);

    // ─── 7. USER LOGS (activity last 7 days) ─────────────────────────────────
    const userLogsLast7Days = await count("UserLog", {
      createdAt: { $gte: last7Days },
    });

    // ─── 8. WEEKLY TREND — new users + new listings (last 7 days by day) ─────
    const buildDailyTrend = async (modelName, matchFilter = {}) => {
      const data = await mongoose.model(modelName).aggregate([
        { $match: { ...matchFilter, createdAt: { $gte: last7Days, $lte: today } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
      ]);

      const result = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(last7Days);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        const match = data.find((item) => item._id === dateStr);
        result.push({
          date: dateStr,
          day: d.toLocaleDateString("en-US", { weekday: "short" }),
          count: match ? match.count : 0,
        });
      }
      return result;
    };

    const [
      dailyNewUsers,
      dailyNewBusinessListings,
      dailyNewJobs,
      dailyJobApplications,
      dailyEnquiries,
    ] = await Promise.all([
      buildDailyTrend("User", { isDeleted: false }),
      buildDailyTrend("BusinessListing", { isDeleted: false }),
      buildDailyTrend("Job", { isDeleted: false }),
      buildDailyTrend("JobApplication"),
      buildDailyTrend("ListingEnquiry"),
    ]);

    // ─── Assemble ─────────────────────────────────────────────────────────────
    const stats = {

      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        newLast7Days: newUsersLast7Days,
        newLast30Days: newUsersLast30Days,
      },

      listings: {
        totals: {
          all: totalBusiness + totalJobs + totalProperties + totalMarketplace,
          business: totalBusiness,
          jobs: totalJobs,
          properties: totalProperties,
          marketplace: totalMarketplace,
        },
        active: {
          business: activeBusiness,
          jobs: activeJobs,
          properties: activeProperties,
          marketplace: activeMarketplace,
        },
        newLast30Days: {
          business: newBusinessLast30Days,
          jobs: newJobsLast30Days,
          properties: newPropertiesLast30Days,
          marketplace: newMarketplaceLast30Days,
        },
      },

      engagement: {
        jobApplications: {
          total: totalJobApplications,
          newLast7Days: newApplicationsLast7Days,
        },
        enquiries: {
          total: totalListingEnquiries,
          newLast7Days: newEnquiriesLast7Days,
        },
        followUps: {
          total: totalFollowUps,
          pending: pendingFollowUps,
        },
        reviews: {
          total: totalReviews,
          pending: pendingReviews,
        },
        claimRequests: {
          total: totalClaimRequests,
          pending: pendingClaimRequests,
        },
        reportedListings: {
          total: totalReportedListings,
          pending: pendingReports,
        },
      },

      catalogue: {
        categories: totalCategories,
        subcategories: totalSubcategories,
        categoryFeatures: totalCategoryFeatures,
        features: totalFeatures,
        cities: totalCities,
        plans: totalPlans,
        templates: totalTemplates,
      },

      listingEvents: {
        totalViews: events.view,
        totalCalls: events.call,
        totalLeads: events.lead,
        totalWebsiteVisits: events.website_visit,
        totalReviews: events.review,
      },

      googleListings: {
        total: totalGoogleListings,
        claimed: claimedGoogleListings,
        unclaimed: totalGoogleListings - claimedGoogleListings,
      },

      activityLogs: {
        userLogsLast7Days,
      },

      // 7-day daily trends (for charts)
      trends: {
        newUsers: dailyNewUsers,
        newBusinessListings: dailyNewBusinessListings,
        newJobs: dailyNewJobs,
        jobApplications: dailyJobApplications,
        enquiries: dailyEnquiries,
      },
    };

    return successData(res, 200, true, "Admin statistics fetched successfully", stats);
  } catch (err) {
    console.warn("getAdminStats error:", err);
    return errorData(res, 500, false, "Server Error", null, err.message);
  }
};