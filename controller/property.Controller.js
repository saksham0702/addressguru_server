// ─── propertyListingController.js ────────────────────────────────────────────
import PropertyListing from "../model/propertyListingSchema.js";
import AdditionalField from "../model/additionalFieldSchema.js";
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
    fieldDocs.map((f) => [f._id.toString(), f])
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
    if (fieldErrors.length) { errors.push(...fieldErrors); continue; }

    validated.push({
      field_id:    doc._id,
      field_label: doc.field_label,
      field_type:  doc.field_type,
      value:       submitted.value ?? null,
    });
  }

  return { errors, validated };
};

// ─── Helper: parse array fields from multipart ───────────────────────────────
const toArray = (val) =>
  Array.isArray(val) ? val : [val].filter(Boolean);

// ─── POST /property-listings ──────────────────────────────────────────────────
export const createPropertyListing = async (req, res) => {
  try {
    const {
      category_id, sub_category_id, city_id,
      title, description, purpose, property_type,
      price_amount, price_currency = "PKR",
      price_negotiable = false, price_period = "one-time",
      area_size, area_unit = "marla",
      bedrooms, bathrooms, floor_number, total_floors,
      construction_status = "ready", furnishing = "unfurnished",
      amenities = [], utilities = [], nearby_places = [],
      payments = [], additional_fields = [],
    } = req.body;

    // parse additional_fields if string (multipart safety)
    let parsedAdditionalFields = additional_fields;
    if (typeof additional_fields === "string") {
      try { parsedAdditionalFields = JSON.parse(additional_fields); }
      catch { parsedAdditionalFields = []; }
    }

    const { errors, validated } = await validateAdditionalFields(parsedAdditionalFields);
    if (errors.length)
      return errorData(res, 400, false, "Validation failed", { errors });

    const slug = `${slugify(title, { lower: true, strict: true })}-${Date.now()}`;

    const listing = await PropertyListing.create({
      category:           category_id,
      subCategory:        sub_category_id  || null,
      city:               city_id,
      title,
      description,
      purpose,
      propertyType:       property_type,
      price: {
        amount:       price_amount       || null,
        currency:     price_currency,
        isNegotiable: price_negotiable,
        period:       price_period,
      },
      area: {
        size: area_size || null,
        unit: area_unit,
      },
      bedrooms:           bedrooms          || null,
      bathrooms:          bathrooms         || null,
      floorNumber:        floor_number      || null,
      totalFloors:        total_floors      || null,
      constructionStatus: construction_status,
      furnishing:         furnishing,
      amenities:          toArray(amenities),
      utilities:          toArray(utilities),
      nearbyPlaces:       toArray(nearby_places),
      paymentModes:       toArray(payments),
      additionalFields:   validated,
      slug,
      stepCompleted:  1,
      isVerified:     false,
      isPublished:    false,
      createdBy:      req.user?._id || null,
    });

    return successData(res, 201, true, "Property listing created successfully", {
      id:   listing._id,
      slug: listing.slug,
    });
  } catch (error) {
    console.error("Create property listing error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── PUT /property-listings/:id/step/:step ────────────────────────────────────
export const updatePropertyListingStep = async (req, res) => {
  try {
    const { id, step } = req.params;

    const listing = await PropertyListing.findOne({ _id: id, isDeleted: false });
    if (!listing) return errorData(res, 404, false, "Listing not found");

    switch (Number(step)) {

      /* ── STEP 1 – PROPERTY INFO ── */
      case 1: {
        const {
          category_id, sub_category_id, city_id,
          title, description, purpose, property_type,
          price_amount, price_currency = "PKR",
          price_negotiable = false, price_period = "one-time",
          area_size, area_unit = "marla",
          bedrooms, bathrooms, floor_number, total_floors,
          construction_status = "ready", furnishing = "unfurnished",
          amenities = [], utilities = [], nearby_places = [],
          payments = [], additional_fields = [],
        } = req.body;

        let parsedAdditionalFields = additional_fields;
        if (typeof additional_fields === "string") {
          try { parsedAdditionalFields = JSON.parse(additional_fields); }
          catch { parsedAdditionalFields = []; }
        }

        const { errors, validated } = await validateAdditionalFields(parsedAdditionalFields);
        if (errors.length)
          return errorData(res, 400, false, "Validation failed", { errors });

        // Regenerate slug only if title changed
        if (title && title !== listing.title) {
          listing.title = title;
          listing.slug  = `${slugify(title, { lower: true, strict: true })}-${Date.now()}`;
        }

        listing.category           = category_id;
        listing.subCategory        = sub_category_id     || null;
        listing.city               = city_id;
        listing.description        = description         || null;
        listing.purpose            = purpose;
        listing.propertyType       = property_type;
        listing.price              = {
          amount:       price_amount       || null,
          currency:     price_currency,
          isNegotiable: price_negotiable,
          period:       price_period,
        };
        listing.area               = { size: area_size || null, unit: area_unit };
        listing.bedrooms           = bedrooms            || null;
        listing.bathrooms          = bathrooms           || null;
        listing.floorNumber        = floor_number        || null;
        listing.totalFloors        = total_floors        || null;
        listing.constructionStatus = construction_status;
        listing.furnishing         = furnishing;
        listing.amenities          = toArray(amenities);
        listing.utilities          = toArray(utilities);
        listing.nearbyPlaces       = toArray(nearby_places);
        listing.paymentModes       = toArray(payments);
        listing.additionalFields   = validated;
        break;
      }

      /* ── STEP 2 – LOCATION ── */
      case 2: {
        listing.location = {
          address:  req.body.address   || null,
          locality: req.body.locality  || null,
          mapLat:   req.body.map_lat   || null,
          mapLng:   req.body.map_lng   || null,
        };
        break;
      }

      /* ── STEP 3 – CONTACT ── */
      case 3: {
        listing.contactPersonName     = req.body.name                 || null;
        listing.email                 = req.body.email                || null;
        listing.countryCode           = req.body.country_code         || null;
        listing.mobileNumber          = req.body.mobile_number        || null;
        listing.altCountryCode        = req.body.alt_country_code     || null;
        listing.alternateMobileNumber = req.body.second_mobile_number || null;
        break;
      }

      /* ── STEP 4 – SOCIAL & LINKS ── */
      case 4: {
        listing.websiteLink = req.body.website_link || null;
        listing.videoLink   = req.body.video_link   || null;
        listing.socialLinks = {
          facebook:  req.body.facebook  || null,
          instagram: req.body.instagram || null,
          youtube:   req.body.youtube   || null,
        };
        break;
      }

      /* ── STEP 5 – SEO ── */
      case 5: {
        listing.seo = {
          title:       req.body.seo_title       || null,
          description: req.body.seo_description || null,
        };
        break;
      }

      /* ── STEP 6 – MEDIA ── */
      case 6: {
        if (req.files?.images?.length > 0) {
          const newImages = req.files.images.map((img) => img.path);
          listing.images = [...(listing.images || []), ...newImages];
        }
        if (req.files?.floor_plan?.[0]) {
          listing.floorPlan = req.files.floor_plan[0].path;
        }
        break;
      }

      /* ── STEP 7 – PLAN & PUBLISH ── */
      case 7: {
        listing.plan        = req.body.plan_id;
        listing.isPublished = true;
        break;
      }

      default:
        return errorData(res, 400, false, "Invalid step");
    }

    listing.stepCompleted = Math.max(listing.stepCompleted, Number(step));
    await listing.save();

    return successData(res, 200, true, `Step ${step} saved successfully`, {
      id:            listing._id,
      stepCompleted: listing.stepCompleted,
    });
  } catch (error) {
    console.error("Update property listing step error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* ── GET ALL (paginated) ── */
export const getAllPropertyListings = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    // Basic filters from query
    const filter = { isDeleted: false, isPublished: true, isVerified: true };
    if (req.query.purpose)       filter.purpose       = req.query.purpose;
    if (req.query.property_type) filter.propertyType  = req.query.property_type;
    if (req.query.city_id)       filter.city          = req.query.city_id;
    if (req.query.furnishing)    filter.furnishing     = req.query.furnishing;
    if (req.query.bedrooms)      filter.bedrooms       = Number(req.query.bedrooms);

    // Price range
    if (req.query.min_price || req.query.max_price) {
      filter["price.amount"] = {};
      if (req.query.min_price) filter["price.amount"].$gte = Number(req.query.min_price);
      if (req.query.max_price) filter["price.amount"].$lte = Number(req.query.max_price);
    }

    const [listings, total] = await Promise.all([
      PropertyListing.find(filter)
        .populate("category",    "name")
        .populate("subCategory", "name")
        .populate("city",        "name")
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
      isDeleted:   false,
      isPublished: true,
    })
      .populate("category",    "name")
      .populate("subCategory", "name")
      .populate("city",        "name")
      .populate("additionalFields.field_id", "field_label field_type")
      .lean();

    if (!listing) return errorData(res, 404, false, "Listing not found");

    return successData(res, 200, true, "Listing fetched successfully", listing);
  } catch (error) {
    console.error("Property listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* ── SOFT DELETE ── */
export const deletePropertyListing = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return errorData(res, 400, false, "Listing id is required");

    const listing = await PropertyListing.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!listing) return errorData(res, 404, false, "Listing not found");

    return successData(res, 200, true, "Listing deleted successfully", { id: listing._id });
  } catch (error) {
    console.error("Property listing delete error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};