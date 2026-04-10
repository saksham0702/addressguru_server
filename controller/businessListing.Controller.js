// ─── businessListingController.js ────────────────────────────────────────────
import BusinessListing from "../model/businessListingSchema.js";
import AdditionalField from "../model/additionalFieldSchema.js";
import Category from "../model/categoriesSchema.js";
import SubCategory from "../model/subCategoriesSchema.js";
import categoryFeatures from "../model/categoryFeatures.js";
import Feature from "../model/featureSchema.js";
import User from "../model/userSchema.js";
import slugify from "slugify";
import { successData, errorData } from "../services/helper.js";
import { APP_BASE_URL } from "../services/constant.js";
import CitiesSchema from "../model/CitiesSchema.js";
import {
  sendApprovedAndRejectedListingMail,
  sendListingSubmittedMail,
  sendTopBusinessesDigestMail,
} from "../utils/sendMail.js";
import googleIndexingService from "../services/googleIndexing.service.js";
import { sendPushNotification } from "../services/notification.service.js";
import DigestMailLog from "../model/digestMailLogSchema.js";
import ListingStats from "../model/listingStatsSchema.js";

// ─── Helper: validate additional fields ───────────────────────────────────────
// ============================================
// HELPER — validate & normalize additional fields
// Drop this into your listing controller file,
// replacing the existing validateAdditionalFields function
// ============================================

const validateAdditionalFields = async (additionalFields = []) => {
  if (!additionalFields.length) return { errors: [], validated: [] };

  const fieldIds = additionalFields.map((f) => f.field_id);
  const fieldDocs = await AdditionalField.find({
    _id: { $in: fieldIds },
    is_active: true,
    is_deleted: false,
  });

  const fieldMap = Object.fromEntries(
    fieldDocs.map((f) => [f._id.toString(), f]),
  );

  const errors = [];
  const validated = [];

  for (const submitted of additionalFields) {
    const doc = fieldMap[submitted.field_id?.toString()];
    if (!doc) {
      errors.push(`Unknown or inactive field: ${submitted.field_id}`);
      continue;
    }

    const fieldErrors = doc.validateValue(submitted.value);
    if (fieldErrors.length) {
      errors.push(...fieldErrors);
      continue;
    }

    // For price fields, store { amount, currency } cleanly
    // For everything else, store the value as-is
    let storedValue;
    if (doc.field_type === "price") {
      storedValue = {
        amount: Number(submitted.value.amount),
        currency: submitted.value.currency,
      };
    } else {
      storedValue = submitted.value ?? null;
    }

    validated.push({
      field_id: doc._id,
      field_label: doc.field_label,
      field_type: doc.field_type,
      value: storedValue,
    });
  }

  return { errors, validated };
};
// ─── Helper: coerce value to array ────────────────────────────────────────────
const toArray = (val) => (Array.isArray(val) ? val : [val].filter(Boolean));
// ─── Helper: parse JSON string safely ─────────────────────────────────────────
const parseJSON = (val, fallback = null) => {
  if (typeof val !== "string") return val ?? fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
};
// ─── POST /business-listings ──────────────────────────────────────────────────
export const createListing = async (req, res) => {
  console.log("req.user testing create listing", req.user);
  try {
    const {
      category_id,
      sub_category_id,
      business_name,
      business_address,
      ad_description,
      establishment_year,
      uen_number,
      facilities = [],
      services = [],
      courses = [],
      payments = [],
      hours,
      additional_fields = [],
    } = req.body;

    // Validate category
    const category = await Category.findOne({
      _id: category_id,
      isDeleted: false,
    });
    if (!category) return errorData(res, 404, false, "Category not found");

    // Validate sub-category if provided
    if (sub_category_id) {
      const subCategory = await SubCategory.findOne({
        _id: sub_category_id,
        category: category_id,
        isDeleted: false,
      });
      if (!subCategory)
        return errorData(res, 404, false, "Sub-category not found");
    }

    // Check duplicate business name (among non-deleted)
    const existingListing = await BusinessListing.findOne({
      businessName: business_name,
      isDeleted: false,
    });
    if (existingListing)
      return errorData(
        res,
        400,
        false,
        "A listing with this business name already exists",
      );

    const parsedHours = parseJSON(hours, null);
    const parsedAdditionalFields = parseJSON(additional_fields, []);

    const { errors, validated } = await validateAdditionalFields(
      Array.isArray(parsedAdditionalFields) ? parsedAdditionalFields : [],
    );
    if (errors.length)
      return errorData(res, 400, false, "Validation failed", { errors });

    const slug = `${slugify(business_name, { lower: true, strict: true })}`;

    const listing = await BusinessListing.create({
      category: category_id,
      subCategory: sub_category_id || null,
      businessName: business_name,
      businessAddress: business_address,
      description: ad_description || null,
      establishedYear: establishment_year || null,
      taxNumber: uen_number || null,
      facilities: toArray(facilities),
      services: toArray(services),
      courses: toArray(courses),
      paymentModes: toArray(payments),
      workingHours: parsedHours,
      additionalFields: validated,
      slug,
      stepCompleted: 1,
      isVerified: false,
      isPublished: false,
      createdBy: req.user.id,
    });

    // Update User statistics
    await User.findByIdAndUpdate(req.user.id, {
      $inc: {
        statistics_totalListings: 1,
        statistics_activeListings: 1,
      },
    });

    return successData(res, 201, true, "Listing created successfully", {
      id: listing._id,
      slug: listing.slug,
    });
  } catch (error) {
    console.warn("Create listing error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

export const updateListingStep = async (req, res) => {
  try {
    const { slug, step } = req.params;

    const listing = await BusinessListing.findOne({ slug, isDeleted: false });
    if (!listing) return errorData(res, 404, false, "Listing not found");
    const user = await User.findById(req.user.id);
    const userRole = user.roles.includes(1);
    // ── Ownership check ──
    if (
      listing.createdBy &&
      req.user?.id &&
      listing.createdBy.toString() !== req.user.id.toString() &&
      !userRole
    ) {
      return errorData(
        res,
        403,
        false,
        "Forbidden: you do not own this listing",
      );
    }

    switch (Number(step)) {
      /* ── STEP 1 – BUSINESS INFO ── */
      case 1: {
        const {
          category_id,
          sub_category_id,
          business_name,
          business_address,
          ad_description,
          establishment_year,
          uen_number,
          facilities = [],
          services = [],
          courses = [],
          payments = [],
          hours,
          additional_fields = [],
        } = req.body;

        // Validate category if provided
        if (category_id) {
          const category = await Category.findOne({
            _id: category_id,
            isDeleted: false,
          });
          if (!category)
            return errorData(res, 404, false, "Category not found");
        }
        // Validate sub-category if provided
        if (sub_category_id) {
          const subCategory = await SubCategory.findOne({
            _id: sub_category_id,
            category: category_id || listing.category,
            isDeleted: false,
          });
          if (!subCategory)
            return errorData(res, 404, false, "Sub-category not found");
        }
        // Check name conflict — exclude current listing
        if (business_name && business_name !== listing.businessName) {
          const conflict = await BusinessListing.findOne({
            businessName: business_name,
            isDeleted: false,
            _id: { $ne: listing._id },
          });
          if (conflict)
            return errorData(
              res,
              400,
              false,
              "A listing with this business name already exists",
            );
          listing.businessName = business_name;
          listing.slug = `${slugify(business_name, { lower: true, strict: true })}`;
        }

        const parsedHours = parseJSON(hours, null);
        const parsedAdditionalFields = parseJSON(additional_fields, []);

        const { errors, validated } = await validateAdditionalFields(
          Array.isArray(parsedAdditionalFields) ? parsedAdditionalFields : [],
        );
        if (errors.length)
          return errorData(res, 400, false, "Validation failed", { errors });

        if (category_id) listing.category = category_id;
        listing.subCategory = sub_category_id || null;
        if (business_address !== undefined)
          listing.businessAddress = business_address;
        if (ad_description !== undefined) listing.description = ad_description;
        listing.establishedYear = establishment_year || null;
        listing.taxNumber = uen_number || null;
        listing.facilities = toArray(facilities);
        listing.services = toArray(services);
        listing.courses = toArray(courses);
        listing.paymentModes = toArray(payments);
        listing.workingHours = parsedHours;
        listing.additionalFields = validated;
        break;
      }

      /* ── STEP 2 – SOCIAL LINKS ── */
      case 2: {
        listing.websiteLink = req.body.website_link || null;
        listing.videoLink = req.body.video_link || null;
        listing.socialLinks = {
          facebook: req.body.facebook || null,
          instagram: req.body.instagram || null,
          twitter: req.body.twitter || null,
          linkedin: req.body.linkedin || null,
          youtube: req.body.youtube || null,
        };
        break;
      }

      /* ── STEP 3 – CONTACT DETAILS ── */
      case 3: {
        listing.contactPersonName = req.body.name || null;
        listing.email = req.body.email || null;
        listing.countryCode = req.body.country_code || null;
        listing.mobileNumber = req.body.mobile_number || null;
        listing.altCountryCode = req.body.alt_country_code || null;
        listing.alternateMobileNumber = req.body.second_mobile_number || null;
        listing.locality = req.body.locality || null;
        listing.city = req.body.city_id || null;
        break;
      }

      /* ── STEP 4 – SEO ── */
      case 4: {
        listing.seo = {
          title: req.body.seo_title || null,
          description: req.body.seo_description || null,
        };
        break;
      }

      /* ── STEP 5 – MEDIA ── */
      case 5: {
        if (!req.files?.logo?.[0] && !req.files?.images?.length) {
          return errorData(
            res,
            400,
            false,
            "Please upload at least a logo or one image",
          );
        }
        if (req.files?.logo?.[0]) {
          listing.logo = req.files.logo[0].path;
        }
        if (req.files?.images?.length > 0) {
          const newImages = req.files.images.map((img) => img.path);
          listing.images = [...(listing.images || []), ...newImages];
        }
        break;
      }

      /* ── STEP 6 – PLAN & PUBLISH ── */
      case 6: {
        if (listing.stepCompleted < 5) {
          return errorData(
            res,
            400,
            false,
            "Please complete all previous steps before publishing",
          );
        }
        listing.plan = req.body.plan_id || null;
        listing.isPublished = true;
        googleIndexingService.notify(
          `${APP_BASE_URL}/business/${listing.slug}`,
          "URL_UPDATED",
        );
        break;
      }

      default:
        return errorData(res, 400, false, "Invalid step");
    }

    listing.stepCompleted = Math.max(listing.stepCompleted, Number(step));
    await listing.save();

    // ── Send submitted mail when step 6 is completed ──
    if (Number(step) === 6) {
      try {
        // Populate category name if not already a string
        const categoryName =
          typeof listing.category === "object"
            ? listing.category?.name || ""
            : ""; // category is stored as ID — populate separately if needed

        await sendListingSubmittedMail(
          listing.email,
          listing.contactPersonName || listing.businessName,
          listing.businessName,
          categoryName,
          new Date().toLocaleDateString("en-AE", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          `https://addressguru.ae/dashboard`,
        );
        console.log(`✅ Submitted mail sent to ${listing.email}`);
      } catch (mailError) {
        console.warn("❌ Submitted mail failed:", mailError.message);
      }
    }

    return successData(res, 200, true, `Step ${step} saved successfully`, {
      id: listing._id,
      slug: listing.slug,
      stepCompleted: listing.stepCompleted,
    });
  } catch (error) {
    console.warn("Update listing step error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── GET Features & Additional Fields by Category ─────────────────────────────
export const getFeaturesAndAdditionalFieldsByCategory = async (req, res) => {
  try {
    const { category_id } = req.params;
    const { subcategory_id } = req.query;

    if (!category_id) {
      return errorData(res, 400, false, "Category id is required");
    }

    const featureFilter = {
      category: category_id,
      ...(subcategory_id && { subcategory: subcategory_id }),
    };

    const additionalFieldFilter = {
      category_id,
      is_deleted: false,
      ...(subcategory_id && { subcategory_id }),
    };

    const [features, additionalFields, paymentModes] = await Promise.all([
      categoryFeatures
        .findOne(featureFilter)
        .populate("facilities", "name iconSvg _id")
        .populate("services", "name iconSvg _id")
        .populate("courses", "name iconSvg _id"),

      AdditionalField.find(additionalFieldFilter).sort({ display_order: 1 }),

      // ✅ FIXED: isDeleted (camelCase) to match Feature schema
      Feature.find({
        type: "payment_mode",
        isDeleted: false,
      }).select("name iconSvg _id"),
    ]);

    const { facilities = [], services = [], courses = [] } = features || {};

    return successData(
      res,
      200,
      true,
      "Features and additional fields fetched successfully",
      {
        features: {
          facilities,
          services,
          courses,
        },
        payment_modes: paymentModes,
        additionalFields: additionalFields || [],
      },
    );
  } catch (error) {
    console.warn("Features and additional fields fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// - get feature and additional fields by category slug
export const getFeaturesAndAdditionalFieldsByCategorySlug = async (
  req,
  res,
) => {
  try {
    const { category_slug } = req.params;
    const { subcategory_slug } = req.query;

    if (!category_slug) {
      return errorData(res, 400, false, "Category slug is required");
    }

    // Step 1: Resolve category slug → _id
    const category = await Category.findOne({ slug: category_slug }).select(
      "_id",
    );
    if (!category) {
      return errorData(res, 404, false, "Category not found");
    }

    // Step 2: Optionally resolve subcategory slug → _id
    let subcategoryId = null;
    if (subcategory_slug) {
      const subcategory = await SubCategory.findOne({
        slug: subcategory_slug,
      }).select("_id");
      subcategoryId = subcategory?._id || null;
    }

    const featureFilter = {
      category: category._id,
      ...(subcategoryId && { subcategory: subcategoryId }),
    };

    const additionalFieldFilter = {
      category_id: category._id,
      is_deleted: false,
      ...(subcategoryId && { subcategory_id: subcategoryId }),
    };

    const [features, additionalFields, paymentModes] = await Promise.all([
      categoryFeatures
        .findOne(featureFilter)
        .populate("facilities", "name icon _id")
        .populate("services", "name icon _id")
        .populate("courses", "name icon _id"),
      AdditionalField.find(additionalFieldFilter).sort({ display_order: 1 }),
      Feature.find({ type: "payment_mode", isDeleted: false }).select(
        "name icon _id",
      ),
    ]);

    const { facilities = [], services = [], courses = [] } = features || {};

    return successData(
      res,
      200,
      true,
      "Features and additional fields fetched successfully",
      {
        features: { facilities, services, courses },
        payment_modes: paymentModes,
        additionalFields: additionalFields || [],
      },
    );
  } catch (error) {
    console.warn("Features and additional fields fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── GET ALL (paginated + filtered) ───────────────────────────────────────────
export const getAllListingsWithPaginationAndFilters = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // ✅ DEBUG: Log what's actually coming in
    console.log("Query Params Received:", req.query);

    // Base filter — only non-deleted
    const filter = { isDeleted: false };

    // Optional filters from query params
    if (req.query.category_id) filter.category = req.query.category_id;
    if (req.query.sub_category_id)
      filter.subCategory = req.query.sub_category_id;
    if (req.query.city_id) filter.city = req.query.city_id;

    if (req.query.is_published !== undefined)
      filter.isPublished = req.query.is_published === "true";
    if (req.query.is_verified !== undefined)
      filter.isVerified = req.query.is_verified === "true";

    if (req.query.provider) filter.provider = req.query.provider;

    // ✅ Status filter with validation
    const VALID_STATUSES = ["pending", "approved", "rejected"];
    if (req.query.status) {
      const statusValue = req.query.status.trim().toLowerCase();
      if (VALID_STATUSES.includes(statusValue)) {
        filter.status = statusValue;
      } else {
        return errorData(
          res,
          400,
          false,
          `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        );
      }
    }

    // ✅ DEBUG: Log the final filter being passed to MongoDB
    console.log("Final MongoDB Filter:", JSON.stringify(filter));

    const [
      listings,
      total,
      totalAll,
      totalPending,
      totalApproved,
      totalRejected,
    ] = await Promise.all([
      BusinessListing.find(filter)
        .populate("category", "name")
        .populate("subCategory", "name")
        .populate("city", "name")
        .populate("plan", "name")
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BusinessListing.countDocuments(filter),
      BusinessListing.countDocuments({ isDeleted: false }),
      BusinessListing.countDocuments({ isDeleted: false, status: "pending" }), // ✅
      BusinessListing.countDocuments({ isDeleted: false, status: "approved" }), // ✅
      BusinessListing.countDocuments({ isDeleted: false, status: "rejected" }), // ✅
    ]);

    // ✅ Return empty array instead of 404 — better UX for filtered results
    return successData(res, 200, true, "Listings fetched successfully", {
      listings,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      totalAll,
      statusCounts: {
        pending: totalPending,
        approved: totalApproved,
        rejected: totalRejected,
      },
    });
  } catch (error) {
    console.warn("Listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// get listings for website
export const getListingsByCategoryAndCity = async (req, res) => {
  try {
    const { category_slug, city_slug } = req.params;
    const {
      page = 1,
      limit = 10,
      sort_by,
      ag_verified,
      facilities_id,
      services_id,
      courses_id,
      payment_mode_id,
      search,
    } = req.query;

    if (!category_slug) {
      return errorData(res, 400, false, "Category slug is required");
    }

    const category = await Category.findOne({
      slug: category_slug,
      isDeleted: false,
    });
    if (!category) {
      return errorData(res, 404, false, "Category not found");
    }

    const filter = {
      category: category._id,
      isDeleted: false,
      status: "approved",
    };

    // City filter
    if (city_slug && city_slug.toLowerCase().trim() !== "all-cities") {
      const city = await CitiesSchema.findOne({
        slug: city_slug,
        deletedAt: null,
      });
      if (!city) {
        return errorData(res, 404, false, "City not found");
      }
      filter.city = city._id;
    }

    // Search filter
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
      ];
    }

    // AG Verified filter
    if (ag_verified === "true") {
      filter.ag_verified = true;
    }

    // Facilities filter
    if (facilities_id) {
      const ids = Array.isArray(facilities_id)
        ? facilities_id
        : facilities_id.split(",");
      if (ids.length > 0) filter.facilities = { $in: ids };
    }

    // Services filter
    if (services_id) {
      const ids = Array.isArray(services_id)
        ? services_id
        : services_id.split(",");
      if (ids.length > 0) filter.services = { $in: ids };
    }

    // Courses filter
    if (courses_id) {
      const ids = Array.isArray(courses_id)
        ? courses_id
        : courses_id.split(",");
      if (ids.length > 0) filter.courses = { $in: ids };
    }

    // Payment mode filter
    if (payment_mode_id) {
      const ids = Array.isArray(payment_mode_id)
        ? payment_mode_id
        : payment_mode_id.split(",");
      if (ids.length > 0) filter.payment_modes = { $in: ids };
    }

    // Sort
    let sortOption = { createdAt: -1 }; // default: newest
    if (sort_by === "oldest") sortOption = { createdAt: 1 };
    else if (sort_by === "popular") sortOption = { views: -1 };

    // Pagination
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const [listings, total] = await Promise.all([
      BusinessListing.find(filter)
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .populate("facilities")
        .populate("city", "name slug")
        .sort(sortOption)
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      BusinessListing.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNumber);

    return successData(res, 200, true, "Listings fetched successfully", {
      listings,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages,
        hasMore: pageNumber < totalPages,
        nextPage: pageNumber < totalPages ? pageNumber + 1 : null,
      },
    });
  } catch (error) {
    console.warn("Listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── GET SINGLE BY SLUG ───────────────────────────────────────────────────────
export const getListingBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return errorData(res, 400, false, "Listing slug is required");
    const listing = await BusinessListing.findOne({
      slug,
      isDeleted: false,
    })
      .populate("category", "name iconSvg slug")
      .populate("subCategory", "name iconSvg slug")
      .populate("city", "name iconSvg slug")
      .populate("additionalFields.field_id", "field_label field_type")
      .populate("facilities", "name iconSvg")
      .populate("services", "name iconSvg")
      .populate("paymentModes", "name iconSvg")
      .populate("courses", "name iconSvg")
      .lean();
    if (!listing) return errorData(res, 404, false, "Listing not found");
    // ✅ Get views count
    const viewsCount = await ListingStats.countDocuments({
      listingId: listing._id,
      listingModel: "BusinessListing",
      type: "view",
    });
    // ✅ Attach views to response
    listing.views = viewsCount;
    return successData(res, 200, true, "Listing fetched successfully", listing);
  } catch (error) {
    console.warn("Listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// get listing by user
export const getListingByUser = async (req, res) => {
  console.log("req.user get listing by user", req.user);
  try {
    const id = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [listings, total] = await Promise.all([
      BusinessListing.find({
        createdBy: id,
        isDeleted: false,
      })
        .populate("category", "name iconSvg")
        .populate("subCategory", "name")
        .populate("city", "name")
        .populate("createdBy", "name email phone avatar") // optional: show owner info
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BusinessListing.countDocuments({
        createdBy: id,
        isDeleted: false,
      }),
    ]);

    // Only return 404 if it's the first page and absolutely no listings exist.
    // If it's page 2+ and empty, frontend pagination usually expects an empty array rather than a 404 error.
    if (!listings.length && page === 1)
      return errorData(res, 404, false, "No listings found for this user");

    return successData(res, 200, true, "Listings fetched successfully", {
      total,
      listings,
    });
  } catch (error) {
    console.warn("Listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── SOFT DELETE ──────────────────────────────────────────────────────────────
export const deleteListing = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return errorData(res, 400, false, "Slug is required");

    const listing = await BusinessListing.findOne({
      slug,
      isDeleted: false,
    });
    if (!listing) return errorData(res, 404, false, "Listing not found");

    // Ownership check
    if (
      listing.createdBy &&
      req.user?._id &&
      listing.createdBy.toString() !== req.user._id.toString()
    ) {
      return errorData(
        res,
        403,
        false,
        "Forbidden: you do not own this listing",
      );
    }

    listing.isDeleted = true;
    await listing.save();

    googleIndexingService.notify(
      `${APP_BASE_URL}/business/${listing.slug}`,
      "URL_DELETED",
    );

    // Update User statistics
    if (listing.createdBy) {
      await User.findByIdAndUpdate(listing.createdBy, {
        $inc: {
          statistics_activeListings: -1,
          statistics_totalListings: -1,
        },
      });
    }

    return successData(res, 200, true, "Listing deleted successfully", {
      id: listing._id,
    });
  } catch (error) {
    console.warn("Listing delete error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

export const updateListingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const adminId = req.user._id;

    // ── Validate status value ───────────────────────────────────────────────
    if (!["approved", "rejected", "unapproved"].includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Status must be either 'approved' or 'rejected' or 'unapproved'",
      });
    }

    // ── Rejection must have a reason ────────────────────────────────────────
    if (status === "rejected" && !rejectionReason?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when rejecting a listing",
      });
    }

    // ── Find the listing ────────────────────────────────────────────────────
    const listing = await BusinessListing.findById(id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    // ── Update fields based on status ───────────────────────────────────────
    listing.status = status;

    if (status === "approved") {
      listing.approvedBy = adminId;
      listing.rejectedBy = null;
      listing.rejectionReason = null;
    }

    if (status === "rejected") {
      listing.rejectedBy = adminId;
      listing.rejectionReason = rejectionReason.trim();
      listing.approvedBy = null;
    }

    if (status === "unapproved") {
      listing.status = "pending";
      listing.approvedBy = null;
      listing.rejectedBy = null;
      listing.rejectionReason = null;
    }

    await listing.save();

    // ── Send mail & notification ────────────────────────────────────────────
    if (status !== "unapproved") {
      try {
        await sendApprovedAndRejectedListingMail(
          listing.email,
          listing.contactPersonName || listing.businessName,
          status,
          status === "rejected" ? rejectionReason.trim() : null,
        );
        console.log(`✅ Mail sent to ${listing.email} for status: ${status}`);

        if (listing.createdBy) {
          const title =
            status === "approved"
              ? "Listing Approved 🎉"
              : "Listing Rejected ❌";
          const body =
            status === "approved"
              ? `Congratulations! Your business listing "${listing.businessName}" has been successfully approved.`
              : `We're sorry, your business listing "${listing.businessName}" was rejected. ${rejectionReason ? "Reason: " + rejectionReason.trim() : ""}`;

          await sendPushNotification(listing.createdBy, title, body, {
            type: "BUSINESS_LISTING_STATUS",
            listingId: listing._id.toString(),
            status: status,
          });
        }
      } catch (mailError) {
        console.warn("❌ Mail/Notification send failed:", mailError.message);
      }
    }

    // Populate for response
    await listing.populate("approvedBy rejectedBy", "name email");

    return res.status(200).json({
      success: true,
      message: `Listing ${status} successfully`,
      data: {
        _id: listing._id,
        businessName: listing.businessName,
        status: listing.status,
        approvedBy: listing.approvedBy,
        rejectedBy: listing.rejectedBy,
        rejectionReason: listing.rejectionReason,
      },
    });
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

//get all approved listings
export const getApprovedListings = async (req, res) => {
  try {
    const listings = await BusinessListing.find({
      status: "approved",
      isDeleted: false,
    });
    return successData(
      res,
      200,
      true,
      "Approved listings fetched successfully",
      listings,
    );
  } catch (error) {
    console.warn("Approved listings fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// sendBusinessDigestMail controller
export const sendBusinessDigestMail = async (req, res) => {
  try {
    const { email, name, category_slug } = req.body;

    if (!email || !name || !category_slug) {
      return errorData(
        res,
        400,
        false,
        "Email, name and category_slug are required",
      );
    }

    const categoryDoc = await Category.findOne({
      slug: category_slug,
      isDeleted: false,
    });
    if (!categoryDoc) {
      return errorData(res, 404, false, "Category not found");
    }

    const listings = await BusinessListing.find({
      isDeleted: false,
      status: "approved",
      category: categoryDoc._id,
    })
      .populate("category", "name")
      .sort({ createdAt: 1 })
      .limit(10)
      .lean();

    if (!listings.length) {
      return errorData(
        res,
        404,
        false,
        "No approved listings found for this category",
      );
    }

    const businesses = listings.map((l) => {
      const phone = l.mobileNumber
        ? `${l.countryCode || ""}${l.mobileNumber}`.trim()
        : null;
      const listingEmail = l.email || null;
      return {
        businessName: l.businessName || "NA",
        businessAddress: l.businessAddress || "NA",
        slug: l.slug || "",
        category: l.category?.name || "NA",
        contactPerson: l.contactPersonName || "NA",
        phone: phone || "NA",
        phoneIsNA: !phone,
        listingEmail: listingEmail || "NA",
        emailIsNA: !listingEmail,
        logoUrl: l.logo || null,
        initial: l.businessName ? l.businessName.charAt(0).toUpperCase() : "B",
      };
    });

    // ── Fire mail & log result ─────────────────────────────────────────────
    let mailStatus = "sent";
    let failureReason = null;

    try {
      await sendTopBusinessesDigestMail(
        email,
        name,
        categoryDoc.name,
        businesses,
      );
      console.log(
        `✅ Digest mail sent to ${email} for category: ${categoryDoc.name}`,
      );
    } catch (mailError) {
      mailStatus = "failed";
      failureReason = mailError.message;
      console.warn("❌ Mail send failed:", mailError.message);
    }

    // ── Save log regardless of mail success/failure ────────────────────────
    await DigestMailLog.create({
      sentTo: email,
      recipientName: name,
      categorySlug: category_slug,
      categoryName: categoryDoc.name,
      categoryId: categoryDoc._id,
      listingsCount: businesses.length,
      listingsSent: listings.map((l) => ({
        businessName: l.businessName || null,
        slug: l.slug || null,
        contactPerson: l.contactPersonName || null,
        phone: l.mobileNumber
          ? `${l.countryCode || ""}${l.mobileNumber}`.trim()
          : null,
        email: l.email || null,
        logoUrl: l.logo || null,
        listingRef: l._id,
      })),
      status: mailStatus,
      failureReason: failureReason,
      sentBy: req.user?.id || null,
    });

    if (mailStatus === "failed") {
      return errorData(res, 500, false, "Mail sending failed", {
        reason: failureReason,
      });
    }

    return successData(res, 200, true, "Digest email sent successfully", {
      sentTo: email,
      category: categoryDoc.name,
      listingsCount: businesses.length,
    });
  } catch (error) {
    console.warn("❌ sendBusinessDigestMail error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};
