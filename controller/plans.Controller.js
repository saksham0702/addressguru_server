// ─── controller/planController.js ────────────────────────────────────────────
import Plan from "../model/plansSchema.js";
import { successData, errorData } from "../services/helper.js";
import slugify from "slugify";

// ─── GET ALL ACTIVE PLANS (public — for frontend listing page) ────────────────
export const getAllPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true, isDeleted: false })
      .sort({ displayOrder: 1 })
      .lean();

    if (!plans.length) return errorData(res, 404, false, "No plans found");

    return successData(res, 200, true, "Plans fetched successfully", { plans });
  } catch (error) {
    console.error("Get all plans error:", error);
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
    console.error("Get plan by slug error:", error);
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
    console.error("Get plan by id error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── CREATE PLAN (admin) ──────────────────────────────────────────────────────
export const createPlan = async (req, res) => {
  try {
    const {
      name,
      tagline,
      displayOrder,
      price,
      billingCycle,
      features,
      limits,
      flags,
      theme,
      ctaLabel,
      isHighlighted,
    } = req.body;

    if (!name) return errorData(res, 400, false, "Plan name is required");
    if (price === undefined || price === null)
      return errorData(res, 400, false, "Plan price is required");

    // Duplicate name check
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
      displayOrder: displayOrder ?? 0,
      price,
      billingCycle: billingCycle || "year",
      features: Array.isArray(features) ? features : [],
      limits: limits || {},
      flags: flags || {},
      theme: theme || "default",
      ctaLabel: ctaLabel || "Get Started",
      isHighlighted: isHighlighted ?? false,
    });

    return successData(res, 201, true, "Plan created successfully", {
      id: plan._id,
      slug: plan.slug,
    });
  } catch (error) {
    console.error("Create plan error:", error);
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
      "billingCycle",
      "features",
      "limits",
      "flags",
      "theme",
      "ctaLabel",
      "isHighlighted",
      "isActive",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        plan[field] = req.body[field];
      }
    }

    // Re-slug if name changed
    if (req.body.name) {
      plan.slug = slugify(req.body.name, { lower: true, strict: true });
    }

    await plan.save();

    return successData(res, 200, true, "Plan updated successfully", {
      id: plan._id,
      slug: plan.slug,
    });
  } catch (error) {
    console.error("Update plan error:", error);
    return errorData(res, 500, false, "Internal server error");
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
    console.error("Delete plan error:", error);
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
    console.error("Seed plans error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};
