import Plan from "../model/plansSchema.js";
import BusinessListing from "../model/businessListingSchema.js";
import MarketplaceListing from "../model/marketplaceListingSchema.js";
import PropertyListing from "../model/propertiesListingSchema.js";
import JobListing from "../model/jobsListingSchema.js";
import { successData, errorData } from "../services/helper.js";
import User from "../model/userSchema.js";
// import { createPaymentRecord } from "../modules/payment/payment.service.js";

import slugify from "slugify";
import { createOrderService } from "../modules/payment/payment.service.js";

// ─── GET ALL ACTIVE PLANS ──────────────────────────────────────────────────

export const getAllPlans = async (req, res) => {
  try {
    const { planType } = req.query;

    const plans = await Plan.find({ planType })
      .sort({ displayOrder: 1 })
      .lean();

    if (!plans.length) {
      return errorData(res, 404, false, "No plans found");
    }

    /*
     * Only modify pricing when there is an authenticated user.
     *
     * optionalAuth gives us:
     * req.user = { id: "..." }
     *
     * The actual roles are stored in User.roles, so fetch them
     * from MongoDB here instead of expecting them in the JWT.
     */
    let userRoles = [];

    if (req.user?.id) {
      const user = await User.findById(req.user.id).select("roles").lean();

      userRoles = Array.isArray(user?.roles) ? user.roles : [];
    }

    console.log("Plans user:", req.user);
    console.log("Plans user roles:", userRoles);

    /*
     * Roles:
     * 1 = admin
     * 2 = editor
     * 3 = agent
     *
     * These roles get the FIRST plan for free.
     */
    const isFreeAccessRole = userRoles.some((role) =>
      [2, 3].includes(Number(role)),
    );

    if (isFreeAccessRole && plans[0]) {
      plans[0] = {
        ...plans[0],
        price: 0,
        actualPrice: plans[0].price,
        discountPercentage: plans[0].price > 0 ? 100 : 0,
      };
    }

    return successData(res, 200, true, "Plans fetched successfully", { plans });
  } catch (error) {
    console.warn("Get all plans error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── GET SINGLE PLAN BY SLUG (public) ────────────────────────────────────────
export const getPlanBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return errorData(res, 400, false, "Plan slug is required");

    const plan = await Plan.findOne({
      slug,
      isActive: true,
      isDeleted: false,
    }).lean();

    if (!plan) return errorData(res, 404, false, "Plan not found");

    return successData(res, 200, true, "Plan fetched successfully", { plan });
  } catch (error) {
    console.warn("Get plan by slug error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── GET SINGLE PLAN BY ID (public / internal) ───────────────────────────────
export const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return errorData(res, 400, false, "Plan id is required");

    const plan = await Plan.findOne({
      _id: id,
      isDeleted: false,
    }).lean();

    if (!plan) return errorData(res, 404, false, "Plan not found");

    return successData(res, 200, true, "Plan fetched successfully", { plan });
  } catch (error) {
    console.warn("Get plan by id error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── CREATE PLAN (admin) ──────────────────────────────────────────────────────
export const createPlan = async (req, res) => {
  try {
    const {
      name,
      tagline,
      planType,
      displayOrder,
      price, // FIX: was missing
      actualPrice, // NEW
      billingCycle, // FIX: was missing
      features, // FIX: was missing
      tableFeatures, // NEW: comparison table features
      limits,
      flags,
      theme,
      ctaLabel,
      isHighlighted,
      planCode,
      currency,
      durationInDays,
    } = req.body;

    if (!name) return errorData(res, 400, false, "Plan name is required");
    if (!planCode) return errorData(res, 400, false, "Plan code is required");
    if (price === undefined || price === null)
      return errorData(res, 400, false, "Plan price is required");

    if (
      actualPrice !== undefined &&
      actualPrice !== null &&
      actualPrice < price
    ) {
      return errorData(
        res,
        400,
        false,
        "Actual price cannot be lower than the discounted price",
      );
    }

    const existing = await Plan.findOne({
      name: name.trim(),
      isDeleted: false,
    });
    if (existing)
      return errorData(res, 400, false, "A plan with this name already exists");

    const slug = slugify(name, { lower: true, strict: true });

    const plan = await Plan.create({
      name: name.trim(),
      slug,
      tagline: tagline || null,
      planType: planType || "business",
      displayOrder: displayOrder ?? 0,
      price,
      actualPrice: actualPrice ?? null,
      billingCycle: billingCycle || "year",
      features: Array.isArray(features) ? features : [],
      tableFeatures: Array.isArray(tableFeatures) ? tableFeatures : [],
      limits: limits || {},
      flags: flags || {},
      theme: theme || "default",
      ctaLabel: ctaLabel || "Get Started",
      isHighlighted: isHighlighted ?? false,
      planCode: planCode.toUpperCase().trim(),
      currency: currency || "AED",
      durationInDays: durationInDays || 0,
    });

    return successData(res, 201, true, "Plan created successfully", {
      id: plan._id,
      slug: plan.slug,
    });
  } catch (error) {
    console.warn("Create plan error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── UPDATE PLAN (admin) ──────────────────────────────────────────────────────
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await Plan.findOne({ _id: id, isDeleted: false });
    if (!plan) return errorData(res, 404, false, "Plan not found");

    const allowedFields = [
      "name",
      "tagline",
      "displayOrder",
      "price",
      "actualPrice", // NEW
      "billingCycle",
      "features",
      "tableFeatures", // NEW: comparison table features
      "limits",
      "flags",
      "theme",
      "ctaLabel",
      "isHighlighted",
      "isActive",
      "planCode",
      "currency",
      "planType",
      "durationInDays",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) plan[field] = req.body[field];
    }

    if (req.body.tableFeatures !== undefined) {
      plan.markModified("tableFeatures");
    }

    if (req.body.name) {
      plan.slug = slugify(req.body.name, { lower: true, strict: true });
    }

    await plan.save();

    return successData(res, 200, true, "Plan updated successfully", {
      id: plan._id,
      slug: plan.slug,
    });
  } catch (error) {
    console.warn("Update plan error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ...deletePlan, seedDefaultPlans — unchanged, keep as-is...

// ─── UPGRADE PLAN ───────────────────────────────────────────────────────────
export const upgradePlan = async (req, res) => {
  try {
    const { type, listing_id, plan_id } = req.body;
    if (!type || !listing_id || !plan_id) {
      return errorData(res, 400, false, "Missing required fields");
    }

    const plan = await Plan.findById(plan_id);
    if (!plan) return errorData(res, 404, false, "Plan not found");

    const normalizedType = type.toString().toUpperCase().trim();
    let Model;
    if (normalizedType === "BUSINESS") Model = BusinessListing;
    else if (normalizedType === "MARKETPLACE") Model = MarketplaceListing;
    else if (normalizedType === "PROPERTIES" || normalizedType === "PROPERTY")
      Model = PropertyListing;
    else if (normalizedType === "JOBS" || normalizedType === "JOB")
      Model = JobListing;
    else return errorData(res, 400, false, "Invalid listing type");

    const listing = await Model.findById(listing_id);
    if (!listing) return errorData(res, 404, false, "Listing not found");

    // Extract user ID safely across various JWT payload formats
    const userId = req.user?.id || req.user?._id || req.user;
    if (!userId) {
      return errorData(res, 401, false, "Invalid user authentication");
    }

    // Fetch user roles from DB
    const userDoc = await User.findById(userId).select("roles role").lean();
    const userRoles = Array.isArray(userDoc?.roles)
      ? userDoc.roles
      : userDoc?.role
        ? [userDoc.role]
        : Array.isArray(req.user?.roles)
          ? req.user.roles
          : req.user?.role
            ? [req.user.role]
            : [];

    const isAdmin = userRoles.map(Number).includes(1);

    // If NOT admin, verify ownership
    if (
      !isAdmin &&
      listing.createdBy &&
      listing.createdBy.toString() !== userId.toString()
    ) {
      return errorData(res, 403, false, "Unauthorized");
    }

    // ADMIN OVERRIDE — Direct Plan Assignment without payment
    if (isAdmin) {
      await Model.findByIdAndUpdate(
        listing_id,
        {
          plan: plan._id,
          isPublished: true,
          planStartedAt: new Date(),
          planExpiryDate: null,
          planStatus: "admin_assigned",
        },
        { new: true, runValidators: false },
      );

      return successData(res, 200, true, "Plan updated by Admin successfully", {
        free_plan: true,
        admin_override: true,
      });
    }

    // REGULAR USER FLOW
    const isFreeAccessRole = userRoles.some((r) => [2, 3].includes(Number(r)));
    const isFirstPlan = plan.displayOrder === 1;
    const roleGetsItFree = isFreeAccessRole && isFirstPlan;

    if (plan.price === 0 || roleGetsItFree) {
      await Model.findByIdAndUpdate(
        listing_id,
        {
          plan: plan._id,
          isPublished: true,
          planStartedAt: new Date(),
          planExpiryDate: null,
          planStatus: roleGetsItFree ? "role_free" : "free",
        },
        { new: true, runValidators: false },
      );

      return successData(res, 200, true, "Plan upgraded successfully", {
        free_plan: true,
      });
    }

    /* PAID PLAN — Initiate Razorpay Order */
    const { order, payment } = await createOrderService({
      userId,
      planId: plan._id,
      listingId: listing._id,
    });

    return successData(res, 200, true, "Payment initiated", {
      free_plan: false,
      payment_id: payment._id,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("upgradePlan error details:", error);
    return errorData(res, 500, false, error.message || "Upgrade failed");
  }
};
// ─── SOFT DELETE PLAN (admin) ─────────────────────────────────────────────────
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await Plan.findOne({ _id: id, isDeleted: false });
    if (!plan) return errorData(res, 404, false, "Plan not found");

    plan.isDeleted = true;
    plan.isActive = false;
    await plan.save();

    return successData(res, 200, true, "Plan deleted successfully", {
      id: plan._id,
    });
  } catch (error) {
    console.warn("Delete plan error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── SEED DEFAULT UAE PLANS (admin / one-time setup) ─────────────────────────
export const seedDefaultPlans = async (req, res) => {
  try {
    const existing = await Plan.countDocuments({ isDeleted: false });
    if (existing > 0)
      return errorData(
        res,
        400,
        false,
        "Plans already exist. Use update endpoints to modify them.",
      );

    const defaultPlans = [
      {
        name: "Free Plan",
        slug: "free",
        tagline: null,
        displayOrder: 1,
        price: 0,
        billingCycle: "year",
        theme: "default",
        ctaLabel: "Get Started",
        isHighlighted: false,
        features: [
          "Basic Listing",
          "100 Words Description",
          "No Website Link",
          "No Images Gallery",
          "Standard Ranking",
        ],
        limits: { descriptionWords: 100, businessImages: 0 },
        flags: {
          websiteLinkAllowed: false,
          imagesGalleryAllowed: false,
          seoOptimised: false,
          socialMediaLinks: false,
          leadEnquiryForm: false,
          performanceInsights: false,
          verifiedBadge: false,
          highlightBadge: false,
          featuredInMainCities: false,
          topOfSearchResults: false,
          monthlyOptimisation: false,
          dedicatedSupport: false,
          priorityListing: false,
          videoLinkAllowed: false,
        },
      },
      {
        name: "Starter Plan",
        slug: "starter",
        tagline: null,
        displayOrder: 2,
        price: 299,
        billingCycle: "year",
        theme: "blue",
        ctaLabel: "Get Listed",
        isHighlighted: false,
        features: [
          "Website Link Included",
          "300 Words Description",
          "3 Business Images",
          "Verified Badge",
          "Priority Listing",
        ],
        limits: { descriptionWords: 300, businessImages: 3 },
        flags: {
          websiteLinkAllowed: true,
          imagesGalleryAllowed: true,
          seoOptimised: false,
          socialMediaLinks: false,
          leadEnquiryForm: false,
          performanceInsights: false,
          verifiedBadge: true,
          highlightBadge: false,
          featuredInMainCities: false,
          topOfSearchResults: false,
          monthlyOptimisation: false,
          dedicatedSupport: false,
          priorityListing: true,
          videoLinkAllowed: false,
        },
      },
      {
        name: "Growth Plan",
        slug: "growth",
        tagline: "Most Popular",
        displayOrder: 3,
        price: 549,
        billingCycle: "year",
        theme: "green",
        ctaLabel: "Get Listed",
        isHighlighted: true,
        features: [
          "SEO Optimised",
          "6 Business Images",
          "Social Media Links",
          "Lead Enquiry Form",
          "Performance Insights",
        ],
        limits: { descriptionWords: 600, businessImages: 6 },
        flags: {
          websiteLinkAllowed: true,
          imagesGalleryAllowed: true,
          seoOptimised: true,
          socialMediaLinks: true,
          leadEnquiryForm: true,
          performanceInsights: true,
          verifiedBadge: true,
          highlightBadge: false,
          featuredInMainCities: false,
          topOfSearchResults: false,
          monthlyOptimisation: false,
          dedicatedSupport: false,
          priorityListing: true,
          videoLinkAllowed: true,
        },
      },
      {
        name: "Featured Plan",
        slug: "featured",
        tagline: "Best Visibility",
        displayOrder: 4,
        price: 749,
        billingCycle: "year",
        theme: "gold",
        ctaLabel: "Get Featured",
        isHighlighted: false,
        features: [
          "Featured in Main Cities",
          "Top of Search Results",
          "Highlight Badge",
          "Monthly Optimisation",
          "Dedicated Support",
        ],
        limits: { descriptionWords: 1000, businessImages: 10 },
        flags: {
          websiteLinkAllowed: true,
          imagesGalleryAllowed: true,
          seoOptimised: true,
          socialMediaLinks: true,
          leadEnquiryForm: true,
          performanceInsights: true,
          verifiedBadge: true,
          highlightBadge: true,
          featuredInMainCities: true,
          topOfSearchResults: true,
          monthlyOptimisation: true,
          dedicatedSupport: true,
          priorityListing: true,
          videoLinkAllowed: true,
        },
      },
    ];

    await Plan.insertMany(defaultPlans);

    return successData(
      res,
      201,
      true,
      "Default UAE plans seeded successfully",
      { count: defaultPlans.length },
    );
  } catch (error) {
    console.warn("Seed plans error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── UPGRADE PLAN (simulated payment endpoint) ────────────────────────────────
// export const upgradePlan = async (req, res) => {
//   try {
//     const { type, listing_id, plan_id } = req.body;

//     if (!type || !listing_id || !plan_id) {
//       return errorData(res, 400, false, "Missing required fields");
//     }

//     const plan = await Plan.findById(plan_id);

//     if (!plan) {
//       return errorData(res, 404, false, "Plan not found");
//     }

//     let Model;

//     if (type === "BUSINESS") {
//       Model = BusinessListing;
//     } else if (type === "MARKETPLACE") {
//       Model = MarketplaceListing;
//     } else if (type === "PROPERTIES") {
//       Model = PropertyListing;
//     } else if (type === "JOBS") {
//       Model = JobListing;
//     } else {
//       return errorData(res, 400, false, "Invalid listing type");
//     }

//     const listing = await Model.findById(listing_id);

//     if (!listing) {
//       return errorData(res, 404, false, "Listing not found");
//     }

//     if (listing.createdBy.toString() !== req.user.id.toString()) {
//       return errorData(res, 403, false, "Unauthorized");
//     }

//     /*
//     |--------------------------------------------------------------------------
//     | FREE PLAN
//     |--------------------------------------------------------------------------
//     */

//     if (plan.price === 0) {
//       listing.plan = plan._id;

//       listing.isPublished = true;

//       listing.publishedAt = new Date();

//       await listing.save();

//       return successData(res, 200, true, "Plan upgraded successfully", {
//         free_plan: true,
//       });
//     }

//     /*
//     |--------------------------------------------------------------------------
//     | PAID PLAN
//     |--------------------------------------------------------------------------
//     */

//     const { order, payment } = await createOrderService({
//       userId: req.user.id,

//       planId: plan._id,

//       listingId: listing._id,
//     });

//     return successData(res, 200, true, "Payment initiated", {
//       free_plan: false,

//       payment_id: payment._id,

//       order_id: order.id,

//       amount: order.amount,

//       currency: order.currency,

//       key: process.env.RAZORPAY_KEY_ID,
//     });
//   } catch (error) {
//     console.log(error);

//     return errorData(res, 500, false, "Upgrade failed");
//   }
// };
