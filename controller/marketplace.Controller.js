// ─── marketplaceListingController.js ─────────────────────────────────────────
import MarketplaceListing from "../model/marketplaceListingSchema.js";
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

const toArray = (val) => (Array.isArray(val) ? val : [val].filter(Boolean));

// ─── POST /marketplace-listings ───────────────────────────────────────────────
export const createMarketplaceListing = async (req, res) => {
  console.log("category-id",req.body)
  try {
    const {
      category_id,
      sub_category_id,
      title,
      description,
      condition,
      price_amount,
      price_currency = "AED",
      price_negotiable = false,
      price_fixed = false,
      price_free = false,
      additional_fields = [],
    } = req.body;

    const category = await Category.findOne({
      _id: category_id,
      isDeleted: false,
    });
    if (!category) return errorData(res, 404, false, "Category not found");

    if (sub_category_id) {
      const subCategory = await SubCategory.findOne({
        _id: sub_category_id,
        category: category_id,
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

    const slug = `${slugify(title, { lower: true, strict: true })}-${Date.now()}`;

    const listing = await MarketplaceListing.create({
      category: category_id,
      subCategory: sub_category_id || null,
      title,
      description,
      condition,
      price: {
        amount: price_amount || null,
        currency: price_currency,
        isNegotiable: price_negotiable,
        isFixed: price_fixed,
        isFree: price_free,
      },
      additionalFields: validated,
      slug,
      stepCompleted: 1,
      isVerified: false,
      isPublished: false,
      isSold: false,
      createdBy: req.user?._id || null,
    });

    return successData(res, 201, true, "Listing created successfully", {
      id: listing._id,
      slug: listing.slug,
    });
  } catch (error) {
    console.error("Create marketplace listing error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── PUT /marketplace-listings/:id/step/:step ─────────────────────────────────
export const updateMarketplaceListingStep = async (req, res) => {
  try {
    const { slug , step } = req.params;

    const listing = await MarketplaceListing.findOne({
      slug: slug,
      isDeleted: false,
    });
    if (!listing) return errorData(res, 404, false, "Listing not found");

    switch (Number(step)) {
      /* ── STEP 1 – PRODUCT INFO ── */
      case 1: {
        const {
          category_id,
          sub_category_id,
          title,
          description,
          condition,
          price_amount,
          price_currency = "AED",
          price_negotiable,
          price_fixed,
          price_free,
          additional_fields = [],
        } = req.body;

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

        if (title && title !== listing.title) {
          listing.title = title;
          listing.slug = `${slugify(title, { lower: true, strict: true })}-${Date.now()}`;
        }

        listing.category = category_id;
        listing.subCategory = sub_category_id || null;
        listing.description = description || null;
        listing.condition = condition;
        listing.price = {
          amount: price_amount || null,
          currency: price_currency,
          isNegotiable: price_negotiable || false,
          isFixed: price_fixed || false,
          isFree: price_free || false,
        };
        listing.additionalFields = validated;
        break;
      }

      /* ── STEP 3– CONTACT DETAILS ── */
      case 3: {
        listing.contactPersonName = req.body.name || null;
        listing.email = req.body.email || null;
        listing.countryCode = req.body.country_code || null;
        listing.mobileNumber = req.body.mobile_number || null;
        listing.altCountryCode = req.body.alt_country_code || null;
        listing.alternateMobileNumber = req.body.second_mobile_number || null;
        listing.locality = req.body.locality || null;
        listing.address = req.body.address || null;
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
      case 2: {
        if (req.files?.images?.length > 0) {
          const newImages = req.files.images.map((img) => img.path);
          listing.images = [...(listing.images || []), ...newImages];
        }
        break;
      }

      /* ── STEP 6 – PLAN & PUBLISH ── */
      case 6: {
        listing.plan = req.body.plan_id;
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
      stepCompleted: listing.stepCompleted,
    });
  } catch (error) {
    console.error("Update marketplace listing step error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* ── GET ALL (paginated + filtered) ── */
export const getAllMarketplaceListings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { isDeleted: false, isPublished: true, isVerified: true };

    if (req.query.condition) filter.condition = req.query.condition;
    if (req.query.city_id) filter.city = req.query.city_id;
    if (req.query.category_id) filter.category = req.query.category_id;
    if (req.query.is_sold !== undefined)
      filter.isSold = req.query.is_sold === "true";

    // price range
    if (req.query.min_price || req.query.max_price) {
      filter["price.amount"] = {};
      if (req.query.min_price)
        filter["price.amount"].$gte = Number(req.query.min_price);
      if (req.query.max_price)
        filter["price.amount"].$lte = Number(req.query.max_price);
    }

    // free items toggle
    if (req.query.is_free === "true") filter["price.isFree"] = true;

    const [listings, total] = await Promise.all([
      MarketplaceListing.find(filter)
        .populate("category", "name")
        .populate("subCategory", "name")
        .populate("city", "name")
        .skip(skip)
        .limit(limit)
        .lean(),
      MarketplaceListing.countDocuments(filter),
    ]);

    if (!listings.length)
      return errorData(res, 404, false, "No listings found");

    return successData(res, 200, true, "Listings fetched successfully", {
      listings,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Marketplace listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* ── GET SINGLE BY SLUG ── */
export const getMarketplaceListingBySlug = async (req, res) => {
  try {

    const { slug } = req.params;
    console.log(slug)
    if (!slug) return errorData(res, 400, false, "Slug is required");

    const listing = await MarketplaceListing.findOne({
      slug,
      isDeleted: false,
      // isPublished: true,
    })
      .populate("category", "name")
      .populate("subCategory", "name")
      .populate("city", "name")
      .populate("additionalFields.field_id", "field_label field_type")
      .lean();

    if (!listing) return errorData(res, 404, false, "Listing not found");

    return successData(res, 200, true, "Listing fetched successfully", listing);
  } catch (error) {
    console.error("Marketplace listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* ── MARK AS SOLD ── */
export const markMarketplaceListingAsSold = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return errorData(res, 400, false, "Listing id is required");

    const listing = await MarketplaceListing.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { isSold: true },
      { new: true },
    );
    if (!listing) return errorData(res, 404, false, "Listing not found");

    return successData(res, 200, true, "Listing marked as sold", {
      id: listing._id,
    });
  } catch (error) {
    console.error("Mark as sold error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* ── SOFT DELETE ── */
export const deleteMarketplaceListing = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return errorData(res, 400, false, "Listing id is required");

    const listing = await MarketplaceListing.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true },
    );
    if (!listing) return errorData(res, 404, false, "Listing not found");

    return successData(res, 200, true, "Listing deleted successfully", {
      id: listing._id,
    });
  } catch (error) {
    console.error("Marketplace listing delete error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};
