import BusinessListing from "../model/businessListingSchema.js";
import AdditionalField from "../model/additionalFieldSchema.js";
import slugify from "slugify";
import { successData, errorData } from "../services/helper.js";
import categoryFeatures from "../model/categoryFeatures.js";

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
      field_label: doc.field_label, // snapshot
      field_type: doc.field_type, // snapshot
      value: submitted.value ?? null,
    });
  }

  return { errors, validated };
};

// ─── Main controller ──────────────────────────────────────────────────────────
export const saveListingStep = async (req, res) => {
  try {
    const { listing_id } = req.body;
    const step = req.params.step;
    console.log("content-type:", req.headers["content-type"]);
    console.log("body:", req.body);
    console.log("files:", req.files);

    /* =========================
       STEP 1 – CREATE LISTING
    ========================== */
    if (Number(step) === 1) {
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

      // parse hours if still a string (extra safety)
      let parsedHours = hours;
      if (typeof hours === "string") {
        try {
          parsedHours = JSON.parse(hours);
        } catch {
          parsedHours = null;
        }
      }

      // parse additional_fields if still a string (extra safety)
      let parsedAdditionalFields = additional_fields;
      if (typeof additional_fields === "string") {
        try {
          parsedAdditionalFields = JSON.parse(additional_fields);
        } catch {
          parsedAdditionalFields = [];
        }
      }

      // DB-level validation for dynamic fields
      const { errors, validated } = await validateAdditionalFields(
        parsedAdditionalFields,
      );
      if (errors.length)
        return errorData(res, 400, false, "Validation failed", { errors });
      const existingListing = await BusinessListing.findOne({
        businessName: business_name,
        isDeleted: false,
      });
      if (existingListing) {
        return errorData(res, 400, false, "Listing already exists");
      }

      const baseSlug = slugify(business_name, { lower: true, strict: true });
      const slug = `${baseSlug}-${Date.now()}`;

      const listing = await BusinessListing.create({
        category: category_id,
        subCategory: sub_category_id || null,
        businessName: business_name,
        businessAddress: business_address,
        description: ad_description || null,
        establishedYear: establishment_year || null,
        taxNumber: uen_number || null,
        facilities: Array.isArray(facilities)
          ? facilities
          : [facilities].filter(Boolean),
        services: Array.isArray(services)
          ? services
          : [services].filter(Boolean),
        courses: Array.isArray(courses) ? courses : [courses].filter(Boolean),
        paymentModes: Array.isArray(payments)
          ? payments
          : [payments].filter(Boolean),
        workingHours: parsedHours || null,
        additionalFields: validated,
        slug,
        stepCompleted: 1,
        isVerified: false,
        isPublished: false,
        createdBy: req.user?._id || null,
      });

      return successData(res, 200, true, "Listing created successfully", {
        id: listing._id,
        slug: listing.slug,
      });
    }

    /* =========================
       FIND LISTING (steps 2–6)
    ========================== */
    const listing = await BusinessListing.findOne({
      _id: listing_id,
      isDeleted: false,
    });

    if (!listing) return errorData(res, 404, false, "Listing not found");

    /* =========================
       STEP 2 – SOCIAL LINKS
    ========================== */
    if (Number(step) === 2) {
      listing.websiteLink =
        req.body.website_link || listing.websiteLink || null;
      listing.videoLink = req.body.video_link || listing.videoLink || null;

      listing.socialLinks = {
        facebook: req.body.facebook || listing.socialLinks?.facebook || null,
        instagram: req.body.instagram || listing.socialLinks?.instagram || null,
        twitter: req.body.twitter || listing.socialLinks?.twitter || null,
        linkedin: req.body.linkedin || listing.socialLinks?.linkedin || null,
        youtube: req.body.youtube || listing.socialLinks?.youtube || null,
      };
    }

    /* =========================
       STEP 3 – CONTACT DETAILS
    ========================== */
    if (Number(step) === 3) {
      listing.contactPersonName = req.body.name || null;
      listing.email = req.body.email || null;
      listing.countryCode = req.body.country_code || null;
      listing.mobileNumber = req.body.mobile_number || null;
      listing.altCountryCode = req.body.alt_country_code || null;
      listing.alternateMobileNumber = req.body.second_mobile_number || null;
      listing.locality = req.body.locality || null;
      listing.city = req.body.city || null;
    }

    /* =========================
       STEP 4 – SEO
    ========================== */
    if (Number(step) === 4) {
      listing.seo = {
        title: req.body.seo_title || null,
        description: req.body.seo_description || null,
      };
    }

    /* =========================
       STEP 5 – MEDIA
    ========================== */
    if (Number(step) === 5) {
      // logo — single file
      if (req.files?.logo?.[0]) {
        listing.logo = req.files.logo[0].path;
      }

      // images — multiple files, append to existing
      if (req.files?.images?.length > 0) {
        const newImages = req.files.images.map((img) => img.path);
        listing.images = [...(listing.images || []), ...newImages];
      }
    }

    /* =========================
       STEP 6 – PLAN & PUBLISH
    ========================== */
    if (Number(step) === 6) {
      listing.plan = req.body.plan_id;
      listing.isPublished = true;
      // isVerified stays false until admin approves
    }

    listing.stepCompleted = Math.max(listing.stepCompleted, Number(step));
    await listing.save();

    return successData(res, 200, true, `Step ${step} saved successfully`, {
      id: listing._id,
      stepCompleted: listing.stepCompleted,
    });
  } catch (error) {
    console.error("Listing step error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

export const getFeaturesAndAdditionalFieldsByCategory = async (req, res) => {
  try {
    const { category_id } = req.params;
    const { subcategory_id } = req.query;

    if (!category_id) {
      return res.status(400).json({
        success: false,
        message: "Category id is required",
      });
    }

    const featureFilter = {
      category: category_id,
      ...(subcategory_id && { subcategory: subcategory_id }),
    };

    const additionalFieldFilter = {
      category_id: category_id,
      is_deleted: false,
      ...(subcategory_id && { subcategory_id: subcategory_id }),
    };

    const [features, additionalFields] = await Promise.all([
      categoryFeatures
        .findOne(featureFilter)
        .populate("facilities", "name icon _id")
        .populate("services", "name icon _id")
        .populate("courses", "name icon _id")
        .populate("payment_modes", "name icon _id"),
      AdditionalField.find(additionalFieldFilter).sort({ display_order: 1 }),
    ]);

    // Destructure only the feature arrays from the document (or fallback to empty arrays)
    const {
      facilities = [],
      services = [],
      courses = [],
      payment_modes = [],
    } = features || {};

    return res.status(200).json({
      success: true,
      message: "Features and additional fields fetched successfully",
      features: {
        facilities,
        services,
        courses,
        payment_modes,
      },
      additionalFields: additionalFields || [],
    });
  } catch (error) {
    console.error("Features and additional fields fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getAllListingsWithPaginationAndFilters = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [listings, total] = await Promise.all([
      BusinessListing.find({
        isDeleted: false,
        isPublished: true,
        isVerified: true,
      })
        .populate("category", "name")
        .populate("subCategory", "name")
        .populate("city", "name")
        .skip(skip)
        .limit(limit)
        .lean(),
      BusinessListing.countDocuments({
        isDeleted: false,
        isPublished: true,
        isVerified: true,
      }),
    ]);

    if (!listings.length)
      return errorData(res, 404, false, "No listings found");

    return successData(res, 200, true, "Listings fetched successfully", {
      listings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* =========================
   GET SINGLE LISTING BY ID
========================== */
export const getListingById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return errorData(res, 400, false, "Listing id is required");

    const listing = await BusinessListing.findOne({
      _id: id,
      isDeleted: false,
      isPublished: true,
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

/* =========================
   SOFT DELETE LISTING
========================== */
export const deleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return errorData(res, 400, false, "Listing id is required");

    const listing = await BusinessListing.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true },
    );

    if (!listing) return errorData(res, 404, false, "Listing not found");

    return successData(res, 200, true, "Listing deleted successfully", {
      id: listing._id,
    });
  } catch (error) {
    console.error("Listing delete error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};
