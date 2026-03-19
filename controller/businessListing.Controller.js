// ─── businessListingController.js ────────────────────────────────────────────
import BusinessListing from "../model/businessListingSchema.js";
import AdditionalField from "../model/additionalFieldSchema.js";
import Category from "../model/categoriesSchema.js";
import SubCategory from "../model/subCategoriesSchema.js";
import categoryFeatures from "../model/categoryFeatures.js";
import Feature from "../model/featureSchema.js";
import slugify from "slugify";
import { successData, errorData } from "../services/helper.js";

// ─── Helper: validate additional fields ───────────────────────────────────────
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

    validated.push({
      field_id: doc._id,
      field_label: doc.field_label,
      field_type: doc.field_type,
      value: submitted.value ?? null,
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

    const slug = `${slugify(business_name, { lower: true, strict: true })}-${Date.now()}`;

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
      createdBy: req.user?._id || null,
    });

    return successData(res, 201, true, "Listing created successfully", {
      id: listing._id,
      slug: listing.slug,
    });
  } catch (error) {
    console.error("Create listing error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── PUT /business-listings/:slug/step/:step ──────────────────────────────────
export const updateListingStep = async (req, res) => {
  try {
    const { slug, step } = req.params;

    const listing = await BusinessListing.findOne({ slug, isDeleted: false });
    if (!listing) return errorData(res, 404, false, "Listing not found");

    // ── Ownership check ──
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
          listing.slug = `${slugify(business_name, { lower: true, strict: true })}-${Date.now()}`;
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
        listing.city = req.body.city_id || null; // fixed: was req.body.city
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
        break;
      }

      default:
        return errorData(res, 400, false, "Invalid step");
    }

    listing.stepCompleted = Math.max(listing.stepCompleted, Number(step));
    await listing.save();

    return successData(res, 200, true, `Step ${step} saved successfully`, {
      id: listing._id,
      slug: listing.slug,
      stepCompleted: listing.stepCompleted,
    });
  } catch (error) {
    console.error("Update listing step error:", error);
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
        .populate("facilities", "name icon _id")
        .populate("services", "name icon _id")
        .populate("courses", "name icon _id"),

      AdditionalField.find(additionalFieldFilter).sort({ display_order: 1 }),

      // ✅ FIXED: isDeleted (camelCase) to match Feature schema
      Feature.find({
        type: "payment_mode",
        isDeleted: false,
      }).select("name icon _id"),
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
    console.error("Features and additional fields fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── GET ALL (paginated + filtered) ───────────────────────────────────────────
export const getAllListingsWithPaginationAndFilters = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

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

    const [listings, total] = await Promise.all([
      BusinessListing.find(filter)
        .populate("category", "name")
        .populate("subCategory", "name")
        .populate("city", "name")
        .skip(skip)
        .limit(limit)
        .lean(),
      BusinessListing.countDocuments(filter),
    ]);

    if (!listings.length)
      return errorData(res, 404, false, "No listings found");

    return successData(res, 200, true, "Listings fetched successfully", {
      listings,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Listing fetch error:", error);
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
      // removed hardcoded isPublished:true — allow fetching drafts
    })
      .populate("category", "name")
      .populate("subCategory", "name")
      .populate("city", "name")
      .populate("additionalFields.field_id", "field_label field_type")
      .lean();

    if (!listing) return errorData(res, 404, false, "Listing not found");

    return successData(res, 200, true, "Listing fetched successfully", listing);
  } catch (error) {
    console.error("Listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// get listing by user
export const getListingByUser = async (req, res) => {
  console.log("req.params", req.params);
  try {
    const { id } = req.params;
    console.log("id", id);

    const listings = await BusinessListing.find({
      createdBy: id,
      isDeleted: false,
    })
      .populate("category", "name")
      .populate("subCategory", "name")
      .populate("city", "name")
      .populate("createdBy", "name email phone avatar") // optional: show owner info
      .lean();

    if (!listings.length)
      return errorData(res, 404, false, "No listings found for this user");

    return successData(res, 200, true, "Listings fetched successfully", {
      total: listings.length,
      listings,
    });
  } catch (error) {
    console.error("Listing fetch error:", error);
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

    return successData(res, 200, true, "Listing deleted successfully", {
      id: listing._id,
    });
  } catch (error) {
    console.error("Listing delete error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};
