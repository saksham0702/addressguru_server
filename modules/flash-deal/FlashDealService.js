import FlashDeal from "./flashDealSchema.js";
import FlashDealClaim from "./flashDealClaimSchema.js";
import BusinessListing from "../../model/businessListingSchema.js";
import MarketplaceListing from "../../model/marketplaceListingSchema.js";
import PropertyListing from "../../model/propertiesListingSchema.js";
import JobListing from "../../model/jobsListingSchema.js";

const MODEL_BY_PLAN_TYPE = {
  business: BusinessListing,
  marketplace: MarketplaceListing,
  property: PropertyListing,
  job: JobListing,
};

const FLAG_LABELS = {
  websiteLinkAllowed: "Website Link Included",
  imagesGalleryAllowed: "Image Gallery",
  seoOptimised: "SEO Optimised",
  socialMediaLinks: "Social Media Links",
  leadEnquiryForm: "Lead Enquiry Form",
  performanceInsights: "Performance Insights",
  verifiedBadge: "Verified Badge",
  highlightBadge: "Highlight Badge",
  featuredInMainCities: "Featured in Main Cities",
  topOfSearchResults: "Top of Search Results",
  monthlyOptimisation: "Monthly Optimisation",
  dedicatedSupport: "Dedicated Support",
  priorityListing: "Priority Listing",
  videoLinkAllowed: "Video Link Allowed",
};

const buildFeatureList = (plan) => {
  if (Array.isArray(plan.tableFeatures) && plan.tableFeatures.length > 0) {
    return plan.tableFeatures
      .filter((f) => f.value === true || typeof f.value === "string")
      .map((f) => ({ label: f.label, value: f.value }));
  }
  return Object.entries(plan.flags || {})
    .filter(([, value]) => value === true)
    .map(([key]) => ({ label: FLAG_LABELS[key] || key, value: true }));
};

const serializeClaim = (claim, deal) => ({
  claimId: claim._id,
  dealId: deal._id,
  name: deal.name,
  badgeText: deal.badgeText,
  description: deal.description,
  currency: deal.currency,
  dealPrice: deal.dealPrice,
  originalPrice: deal.basePlan.price,
  discountPercentage:
    deal.basePlan.price > 0
      ? Math.round(
          ((deal.basePlan.price - deal.dealPrice) / deal.basePlan.price) * 100,
        )
      : 0,
  planId: deal.basePlan._id,
  planName: deal.basePlan.name,
  theme: deal.basePlan.theme,
  flags: deal.basePlan.flags,
  billingCycle: deal.basePlan.billingCycle,
  durationInDays: deal.basePlan.durationInDays,
  planFeatures: buildFeatureList(deal.basePlan),
  ctaLabel: "Grab This Deal Now",
  expiresAt: claim.expiresAt,
  startedAt: claim.startedAt,
  listingId: claim.listing || null,
});

// Recomputes status against wall-clock time and persists if it flipped.
const settleClaim = async (claim) => {
  if (claim.status === "active" && claim.expiresAt.getTime() <= Date.now()) {
    claim.status = "expired";
    await claim.save();
  }
  return claim;
};

/*
|--------------------------------------------------------------------------
| CHECK / CREATE CLAIM FOR THIS USER
|--------------------------------------------------------------------------
| Idempotent: safe to call on every page load. Only the FIRST call ever
| starts the timer for a given user+deal pair.
*/
export const checkFlashDealForUser = async ({ userId, planType }) => {
  const deal = await FlashDeal.findOne({ isActive: true, planType }).populate(
    "basePlan",
  );

  if (!deal) return null;

  let claim = await FlashDealClaim.findOne({ user: userId, deal: deal._id });

  if (claim) {
    // Claim already exists — settle its status (may flip to expired) and
    // return it regardless of eligibility. Eligibility only gatekeeps
    // creation of a NEW claim; an existing claim is always shown.
    claim = await settleClaim(claim);
    if (claim.status !== "active") return null;
    return serializeClaim(claim, deal);
  }

  // No claim yet — check eligibility before creating one.
  if (deal.eligibility === "first_listing_only") {
    const Model = MODEL_BY_PLAN_TYPE[planType];
    const alreadyHasListing = Model
      ? await Model.exists({ createdBy: userId })
      : false;
    if (alreadyHasListing) return null; // not eligible, skip claim creation
  }

  // Create a new claim (idempotent — unique index prevents duplicates).
  const now = new Date();
  try {
    claim = await FlashDealClaim.create({
      user: userId,
      deal: deal._id,
      planType,
      startedAt: now,
      expiresAt: new Date(now.getTime() + deal.durationMinutes * 60000),
      status: "active",
    });
  } catch (err) {
    // Race condition on unique index — re-fetch the claim created by the
    // other parallel request and return that instead.
    if (err.code === 11000) {
      claim = await FlashDealClaim.findOne({ user: userId, deal: deal._id });
      if (!claim) return null;
      claim = await settleClaim(claim);
      if (claim.status !== "active") return null;
      return serializeClaim(claim, deal);
    }
    throw err;
  }

  claim = await settleClaim(claim);
  if (claim.status !== "active") return null;

  return serializeClaim(claim, deal);
};

/*
|--------------------------------------------------------------------------
| ATTACH LISTING TO A CLAIM
|--------------------------------------------------------------------------
| Call this right after step-1 of the listing form creates the draft
| listing, so the dashboard can later resume the SAME listing.
*/
export const attachListingToClaim = async ({ userId, claimId, listingId }) => {
  if (!claimId || !listingId) return null;
  return FlashDealClaim.findOneAndUpdate(
    { _id: claimId, user: userId, status: "active" },
    { listing: listingId },
    { new: true },
  );
};

/*
|--------------------------------------------------------------------------
| GET ALL ACTIVE CLAIMS FOR DASHBOARD
|--------------------------------------------------------------------------
*/
export const getMyActiveFlashDeals = async (userId) => {
  const claims = await FlashDealClaim.find({
    user: userId,
    status: "active",
  }).populate({ path: "deal", populate: { path: "basePlan" } });

  const results = [];
  for (let claim of claims) {
    if (!claim.deal) continue;
    claim = await settleClaim(claim);
    if (claim.status !== "active") continue;

    let listingDetails = null;
    if (claim.listing) {
      const Model =
        MODEL_BY_PLAN_TYPE[claim.planType || "business"] || BusinessListing;
      if (Model) {
        const listingDoc = await Model.findById(claim.listing)
          .populate("category", "name category_name categoryName slug")
          .select("slug businessName category");
        if (listingDoc) {
          const catName =
            listingDoc.category?.name ||
            listingDoc.category?.category_name ||
            listingDoc.category?.categoryName ||
            "";
          listingDetails = {
            _id: listingDoc._id,
            slug: listingDoc.slug,
            categoryId: listingDoc.category?._id || listingDoc.category,
            categoryName: catName,
          };
        }
      }
    }

    results.push({
      ...serializeClaim(claim, claim.deal),
      listingId: claim.listing,
      listingDetails,
    });
  }
  return results;
};

export const getClaimOrThrow = async (userId, claimId) => {
  const claim = await FlashDealClaim.findOne({
    _id: claimId,
    user: userId,
  }).populate({ path: "deal", populate: { path: "basePlan" } });

  if (!claim) throw new Error("Deal claim not found");
  await settleClaim(claim);
  if (claim.status === "purchased") throw new Error("Deal already used");
  if (claim.status !== "active") throw new Error("This deal has expired");

  return claim;
};

export const markClaimPurchased = async (claimId) => {
  await FlashDealClaim.findByIdAndUpdate(claimId, {
    status: "purchased",
    purchasedAt: new Date(),
  });
};

/*
|--------------------------------------------------------------------------
| GET ALL ACTIVE, ELIGIBLE DEALS FOR THIS USER / PLAN TYPE
|--------------------------------------------------------------------------
| Returns every active deal the user is eligible for, each backed by its
| own claim (creating one per deal on first call — idempotent via the
| same unique-index / race-condition handling as checkFlashDealForUser).
| Timer starts as soon as a claim is created on this first call.
*/
export const getActiveFlashDealsForUser = async ({ userId, planType }) => {
  const deals = await FlashDeal.find({ isActive: true, planType }).populate(
    "basePlan",
  );

  if (!deals.length) return [];

  const results = [];

  for (const deal of deals) {
    // ── Existing claim path ───────────────────────────────────────────────
    let claim = await FlashDealClaim.findOne({ user: userId, deal: deal._id });

    if (claim) {
      claim = await settleClaim(claim);
      if (claim.status === "active") results.push(serializeClaim(claim, deal));
      continue;
    }

    // ── Eligibility check before creating a new claim ─────────────────────
    if (deal.eligibility === "first_listing_only") {
      const Model = MODEL_BY_PLAN_TYPE[planType];
      const alreadyHasListing = Model
        ? await Model.exists({ createdBy: userId })
        : false;
      if (alreadyHasListing) continue;
    }

    // ── Create new claim (idempotent via unique index) ────────────────────
    const now = new Date();
    try {
      claim = await FlashDealClaim.create({
        user: userId,
        deal: deal._id,
        planType,
        startedAt: now,
        expiresAt: new Date(now.getTime() + deal.durationMinutes * 60000),
        status: "active",
      });
    } catch (err) {
      // Race condition on unique index — re-fetch and proceed
      if (err.code === 11000) {
        claim = await FlashDealClaim.findOne({ user: userId, deal: deal._id });
        if (!claim) continue;
      } else {
        throw err;
      }
    }

    claim = await settleClaim(claim);
    if (claim.status === "active") results.push(serializeClaim(claim, deal));
  }

  return results;
};
