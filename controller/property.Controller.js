// ─── propertyListingController.js ────────────────────────────────────────────
import PropertyListing from "../model/propertiesListingSchema.js";
import AdditionalField from "../model/additionalFieldSchema.js";
import Category from "../model/categoriesSchema.js";
import SubCategory from "../model/subCategoriesSchema.js";
import slugify from "slugify";
import { successData, errorData } from "../services/helper.js";

// ─── Helper: validate additional fields ──────────────────────────────────────
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

// ─── Helper: parse array fields from multipart ───────────────────────────────
const toArray = (val) => (Array.isArray(val) ? val : [val].filter(Boolean));

// ─── POST /property-listings ──────────────────────────────────────────────────
export const createPropertyListing = async (req, res) => {
  try {
    const {
      category_id,
      sub_category_id,
      title,
      description,
      purpose,
      price_amount,
      price_currency = "AED",
      price_negotiable = false,
      price_period = "one-time",
      area_size,
      area_unit = "sqft",
      payments = [],
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

    // Parse additional_fields if string (multipart safety)
    let parsedAdditionalFields = additional_fields;
    if (typeof additional_fields === "string") {
      try {
        parsedAdditionalFields = JSON.parse(additional_fields);
      } catch {
        parsedAdditionalFields = [];
      }
    }

    const { errors, validated } = await validateAdditionalFields(
      parsedAdditionalFields,
    );
    if (errors.length)
      return errorData(res, 400, false, "Validation failed", { errors });

    const slug = `${slugify(title, { lower: true, strict: true })}-${Date.now()}`;

    const listing = await PropertyListing.create({
      category: category_id,
      subCategory: sub_category_id || null,
      title,
      description,
      purpose,
      price: {
        amount: price_amount || null,
        currency: price_currency,
        isNegotiable: price_negotiable,
        period: price_period,
      },
      area: {
        size: area_size || null,
        unit: area_unit,
      },
      paymentModes: toArray(payments),
      additionalFields: validated,
      slug,
      stepCompleted: 1,
      isVerified: false,
      isPublished: false,
      isSold: false,
      createdBy: req.user?.id || null,
    });

    return successData(
      res,
      201,
      true,
      "Property listing created successfully",
      {
        id: listing._id,
        slug: listing.slug,
      },
    );
  } catch (error) {
    console.error("Create property listing error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── PUT /property-listings/:slug/step/:step ──────────────────────────────────
export const updatePropertyListingStep = async (req, res) => {
  try {
    const { slug, step } = req.params;

    const listing = await PropertyListing.findOne({
      slug,
      isDeleted: false,
    });
    if (!listing) return errorData(res, 404, false, "Listing not found");

    // ── Ownership check ──
    if (
      listing.createdBy &&
      req.user?.id &&
      listing.createdBy.toString() !== req.user.id.toString()
    ) {
      return errorData(
        res,
        403,
        false,
        "Forbidden: you do not own this listing",
      );
    }

    switch (Number(step)) {
      /* ── STEP 1 – PROPERTY INFO ── */
      case 1: {
        const {
          category_id,
          sub_category_id,
          title,
          description,
          purpose,
          price_amount,
          price_currency = "AED",
          price_negotiable = false,
          price_period = "one-time",
          area_size,
          area_unit = "sqft",
          payments = [],
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

        let parsedAdditionalFields = additional_fields;
        if (typeof additional_fields === "string") {
          try {
            parsedAdditionalFields = JSON.parse(additional_fields);
          } catch {
            parsedAdditionalFields = [];
          }
        }

        const { errors, validated } = await validateAdditionalFields(
          parsedAdditionalFields,
        );
        if (errors.length)
          return errorData(res, 400, false, "Validation failed", { errors });

        // Regenerate slug only if title changed
        if (title && title !== listing.title) {
          listing.title = title;
          listing.slug = `${slugify(title, { lower: true, strict: true })}-${Date.now()}`;
        }

        if (category_id) listing.category = category_id;
        listing.subCategory = sub_category_id || null;
        if (description !== undefined) listing.description = description;
        if (purpose !== undefined) listing.purpose = purpose;
        listing.price = {
          amount: price_amount || null,
          currency: price_currency,
          isNegotiable: price_negotiable,
          period: price_period,
        };
        listing.area = { size: area_size || null, unit: area_unit };
        listing.paymentModes = toArray(payments);
        listing.additionalFields = validated;
        break;
      }

      /* ── STEP 2 – MEDIA (IMAGES) ── */
      case 2: {
        if (req.files?.images?.length > 0) {
          const newImages = req.files.images.map((img) => img.path);
          listing.images = [...(listing.images || []), ...newImages];
        } else {
          return errorData(res, 400, false, "No images provided");
        }
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
        listing.city = req.body.city_id || null;
        listing.location = {
          address: req.body.address || null,
          locality: req.body.locality || null,
          mapLat: req.body.map_lat ? Number(req.body.map_lat) : null,
          mapLng: req.body.map_lng ? Number(req.body.map_lng) : null,
        };
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

      /* ── STEP 5 – PLAN & PUBLISH ── */
      case 5: {
        if (listing.stepCompleted < 4) {
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
    console.error("Update property listing step error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* ── GET ALL (paginated + filtered) ── */
export const getAllPropertyListings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Base filter — only non-deleted listings
    const filter = { isDeleted: false };

    // Optional filters from query params
    if (req.query.purpose) filter.purpose = req.query.purpose;
    if (req.query.city_id) filter.city = req.query.city_id;
    if (req.query.category_id) filter.category = req.query.category_id;
    if (req.query.sub_category_id)
      filter.subCategory = req.query.sub_category_id;
    if (req.query.area_unit) filter["area.unit"] = req.query.area_unit;
    if (req.query.is_sold !== undefined)
      filter.isSold = req.query.is_sold === "true";
    if (req.query.is_published !== undefined)
      filter.isPublished = req.query.is_published === "true";
    if (req.query.is_verified !== undefined)
      filter.isVerified = req.query.is_verified === "true";

    // Price range
    if (req.query.min_price || req.query.max_price) {
      filter["price.amount"] = {};
      if (req.query.min_price)
        filter["price.amount"].$gte = Number(req.query.min_price);
      if (req.query.max_price)
        filter["price.amount"].$lte = Number(req.query.max_price);
    }

    // Area size range
    if (req.query.min_area || req.query.max_area) {
      filter["area.size"] = {};
      if (req.query.min_area)
        filter["area.size"].$gte = Number(req.query.min_area);
      if (req.query.max_area)
        filter["area.size"].$lte = Number(req.query.max_area);
    }

    const [listings, total] = await Promise.all([
      PropertyListing.find(filter)
        .populate("category", "name")
        .populate("subCategory", "name")
        .populate("city", "name")
        .skip(skip)
        .limit(limit)
        .lean(),
      PropertyListing.countDocuments(filter),
    ]);

    if (!listings.length)
      return errorData(res, 404, false, "No listings found");

    return successData(res, 200, true, "Listings fetched successfully", {
      listings,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Property listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* ── GET SINGLE BY SLUG ── */
export const getPropertyListingBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return errorData(res, 400, false, "Slug is required");

    const listing = await PropertyListing.findOne({
      slug,
      isDeleted: false,
    })
      .populate("category", "name")
      .populate("subCategory", "name")
      .populate("city", "name")
      .populate("additionalFields.field_id", "field_label field_type")
      .lean();

    if (!listing) return errorData(res, 404, false, "Listing not found");

    return successData(res, 200, true, "Listing fetched successfully", listing);
  } catch (error) {
    console.error("Property listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// get property by user
export const getPropertyListingByUser = async (req, res) => {
  console.log("req.user get property by user", req.user);
  try {
    const id = req.user?.id;
    if (!id) return errorData(res, 400, false, "Id is required");

    const listing = await PropertyListing.find({
      createdBy: id,
      isDeleted: false,
    })
      .populate("category", "name")
      .populate("subCategory", "name")
      .populate("city", "name")
      .populate("additionalFields.field_id", "field_label field_type")
      .lean();

    if (!listing.length)
      return errorData(res, 404, false, "No listings found");

    return successData(res, 200, true, "Listings fetched successfully", listing);
  } catch (error) {
    console.error("Property listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* ── MARK AS SOLD ── */
export const markPropertyListingAsSold = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return errorData(res, 400, false, "Slug is required");

    const listing = await PropertyListing.findOne({
      slug,
      isDeleted: false,
    });
    if (!listing) return errorData(res, 404, false, "Listing not found");

    // Ownership check
    if (
      listing.createdBy &&
      req.user?.id &&
      listing.createdBy.toString() !== req.user.id.toString()
    ) {
      return errorData(
        res,
        403,
        false,
        "Forbidden: you do not own this listing",
      );
    }

    listing.isSold = true;
    await listing.save();

    return successData(res, 200, true, "Listing marked as sold", {
      id: listing._id,
    });
  } catch (error) {
    console.error("Mark as sold error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* ── SOFT DELETE ── */
export const deletePropertyListing = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return errorData(res, 400, false, "Slug is required");

    const listing = await PropertyListing.findOne({
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
    console.error("Property listing delete error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};
