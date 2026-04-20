import ListingStats from "../model/listingStatsSchema.js";
import User from "../model/userSchema.js";
import { resolveListing, MODEL_MAP } from "../utils/resolveListing.js";
import { successData, errorData } from "../services/helper.js";
import mongoose from "mongoose";

/**
 * Record a listing interaction (view, call, website_visit)
 * POST /api/v1/statistics/track
 */
export const trackEvent = async (req, res) => {
  try {
    const { type, slug } = req.params;
    const { type: eventType } = req.body;

    if (!["view", "call", "website_visit"].includes(eventType)) {
      return errorData(res, 400, false, "Invalid event type");
    }

    // Find the listing
    const { listing, modelName } = await resolveListing(slug, type);
    const listingId = listing._id;
    const listingModel = modelName;
    const ownerId = listing.createdBy;

    // Record the stat
    await ListingStats.create({
      listingId,
      listingModel,
      type: eventType,
      userId: req.user?.id || null,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Increment user stats
    const updateField =
      eventType === "view" ? "statistics_totalViews" :
        eventType === "call" ? "statistics_totalCalls" :
          eventType === "website_visit" ? "statistics_totalWebsiteVisits" : null;

    if (updateField && ownerId) {
      await User.findByIdAndUpdate(ownerId, { $inc: { [updateField]: 1 } });
    }

    return successData(res, 200, true, "Event tracked successfully");
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    console.warn("trackEvent error:", err);
    return errorData(res, 500, false, "Server Error", null, err.message);
  }
};

/**
 * Get user global statistics overview
 * GET /api/v1/statistics/overview
 */
export const getUserOverview = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorData(res, 401, false, "Unauthorized");

    const user = await User.findById(userId);
    if (!user) return errorData(res, 404, false, "User not found");

    // Count listings by type for this user
    const [businessCount, jobCount, propertyCount, marketplaceCount] = await Promise.all([
      mongoose.model("BusinessListing").countDocuments({ createdBy: userId, isDeleted: false }),
      mongoose.model("Job").countDocuments({ createdBy: userId, isDeleted: false }),
      mongoose.model("PropertyListing").countDocuments({ createdBy: userId, isDeleted: false }),
      mongoose.model("MarketplaceListing").countDocuments({ createdBy: userId, isDeleted: false }),
    ]);

    // Global Leads Analytics (Current Week vs Previous Week)
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const startOfCurrentWeek = new Date(today);
    startOfCurrentWeek.setDate(today.getDate() - 7);
    startOfCurrentWeek.setHours(0, 0, 0, 0);

    const startOfPreviousWeek = new Date(startOfCurrentWeek);
    startOfPreviousWeek.setDate(startOfCurrentWeek.getDate() - 7);

    const getGlobalDailyLeads = async (startDate, endDate) => {
      const data = await ListingStats.aggregate([
        {
          $match: {
            type: "lead",
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 }
          }
        }
      ]);

      const result = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        const dayMatch = data.find(item => item._id === dateStr);
        result.push({
          date: dateStr,
          day: d.toLocaleDateString("en-US", { weekday: "short" }),
          count: dayMatch ? dayMatch.count : 0
        });
      }
      return result;
    };

    const currentWeekLeads = await getGlobalDailyLeads(startOfCurrentWeek, today);
    const previousWeekLeads = await getGlobalDailyLeads(startOfPreviousWeek, startOfCurrentWeek);

    const stats = {
      listingCounts: {
        total: businessCount + jobCount + propertyCount + marketplaceCount,
        business: businessCount,
        jobs: jobCount,
        properties: propertyCount,
        products: marketplaceCount,
      },
      overview: {
        totalViews: user.statistics_totalViews || 0,
        totalCalls: user.statistics_totalCalls || 0,
        totalLeads: user.statistics_totalLeads || 0,
        totalReviews: user.statistics_totalReviews || 0,
        websiteVisits: user.statistics_totalWebsiteVisits || 0,
      },
      analytics: {
        leads: {
          currentWeek: currentWeekLeads,
          previousWeek: previousWeekLeads,
          currentTotal: currentWeekLeads.reduce((acc, curr) => acc + curr.count, 0),
          previousTotal: previousWeekLeads.reduce((acc, curr) => acc + curr.count, 0)
        }
      }
    };

    return successData(res, 200, true, "User overview fetched successfully", stats);
  } catch (err) {
    console.warn("getUserOverview error:", err);
    return errorData(res, 500, false, "Server Error", null, err.message);
  }
};

/**
 * Get statistics for a particular listing
 * GET /api/v1/statistics/listing/:type/:slug
 */
export const getListingStats = async (req, res) => {
  try {
    const { type, slug } = req.params;
    const { listing, modelName } = await resolveListing(slug, type);

    // Ownership check: only the creator can see stats
    if (listing.createdBy && listing.createdBy.toString() !== req.user.id) {
      return errorData(res, 403, false, "Unauthorized: You do not own this listing");
    }

    // Get aggregated stats for this listing
    const aggregatedStats = await ListingStats.aggregate([
      { $match: { listingId: listing._id } },
      { $group: { _id: "$type", count: { $sum: 1 } } }
    ]);

    const statsMap = {
      view: 0,
      call: 0,
      website_visit: 0,
      lead: 0,
      review: 0
    };
    aggregatedStats.forEach(s => { statsMap[s._id] = s.count; });

    // Time-series data for Leads Analytics (Current Week vs Previous Week)
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const startOfCurrentWeek = new Date(today);
    startOfCurrentWeek.setDate(today.getDate() - 7);
    startOfCurrentWeek.setHours(0, 0, 0, 0);

    const startOfPreviousWeek = new Date(startOfCurrentWeek);
    startOfPreviousWeek.setDate(startOfCurrentWeek.getDate() - 7);

    const getDailyData = async (startDate, endDate) => {
      const data = await ListingStats.aggregate([
        {
          $match: {
            listingId: listing._id,
            type: "lead",
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 }
          }
        }
      ]);

      // Format into a 7-day array
      const result = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        const dayMatch = data.find(item => item._id === dateStr);
        result.push({
          date: dateStr,
          day: d.toLocaleDateString("en-US", { weekday: "short" }),
          count: dayMatch ? dayMatch.count : 0
        });
      }
      return result;
    };

    const currentWeekData = await getDailyData(startOfCurrentWeek, today);
    const previousWeekWeekStart = new Date(startOfPreviousWeek);
    const previousWeekData = await getDailyData(previousWeekWeekStart, startOfCurrentWeek);

    // Unify address field for different model structures
    const listingAddress = listing.businessAddress || listing.location?.address || listing.address || listing?.company?.address || "";

    return successData(res, 200, true, "Listing statistics fetched successfully", {
      listingId: listing._id,
      title: listing.businessName || listing.title,
      businessAddress: listingAddress,
      slug: listing.slug,
      stepCompleted: listing.stepCompleted || 0,
      overview: {
        totalViews: statsMap.view,
        totalCalls: statsMap.call,
        totalLeads: statsMap.lead,
        totalReviews: statsMap.review,
        websiteVisits: statsMap.website_visit,
      },
      analytics: {
        leads: {
          currentWeek: currentWeekData,
          previousWeek: previousWeekData,
          currentTotal: currentWeekData.reduce((acc, curr) => acc + curr.count, 0),
          previousTotal: previousWeekData.reduce((acc, curr) => acc + curr.count, 0)
        }
      }
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ status: false, message: err.message });
    console.warn("getListingStats error:", err);
    return errorData(res, 500, false, "Server Error", null, err.message);
  }
};
