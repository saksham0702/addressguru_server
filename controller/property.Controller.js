// ─── propertyListingController.js ────────────────────────────────────────────
import PropertyListing from "../model/propertiesListingSchema.js";
import User from "../model/userSchema.js";
import AdditionalField from "../model/additionalFieldSchema.js";
import Category from "../model/categoriesSchema.js";
import SubCategory from "../model/subCategoriesSchema.js";
import slugify from "slugify";
import { successData, errorData } from "../services/helper.js";
import googleIndexingService from "../services/googleIndexing.service.js";
import { APP_BASE_URL } from "../services/constant.js";
import { sendApprovedAndRejectedListingMail } from "../utils/sendMail.js";
import { sendPushNotification } from "../services/notification.service.js";
import { sendTextMessage } from "../modules/whatsapp/services/whatsappMessage.js";
import CitiesSchema from "../model/CitiesSchema.js";
import Feature from "../model/featureSchema.js";
import mongoose from "mongoose";

// ─── Helper: validate additional fields ──────────────────────────────────────
const validateAdditionalFields = async (additionalFields = []) => {
  if (!additionalFields.length) return { errors: [], validated: [] };

  const fieldIds = additionalFields
    .map((f) => f.field_id)
    .filter(Boolean);
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
    if (!submitted.field_id) continue;
    const doc = fieldMap[submitted.field_id?.toString()];
    // Skip if field definition was deleted or deactivated
    if (!doc) continue;

    const val = submitted.value;
    // Skip if user removed / cleared the value
    if (val === null || val === undefined || val === "") continue;
    if (Array.isArray(val) && val.length === 0) continue;
    if (
      typeof val === "object" &&
      !Array.isArray(val) &&
      (!val.amount || val.amount.toString().trim() === "")
    ) {
      continue;
    }

    const fieldErrors = doc.validateValue(val);
    if (fieldErrors.length) {
      errors.push(...fieldErrors);
      continue;
    }

    validated.push({
      field_id: doc._id,
      field_label: doc.field_label,
      field_type: doc.field_type,
      value: val,
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
      soldBy,
      title,
      description,
      purpose,
      price_amount,
      price_currency = "AED",
      price_negotiable = false,
      price_period = "one-time",
      area_size,
      area_unit = "sqft",
      cae_number,
      payments = [],
      additional_fields = [],
    } = req.body;

    // Validate category ID
    if (!category_id || !mongoose.Types.ObjectId.isValid(category_id)) {
      return errorData(res, 400, false, "Valid Category ID is required");
    }

    // Validate category
    const category = await Category.findOne({
      _id: category_id,
      isDeleted: false,
    });
    if (!category) return errorData(res, 404, false, "Category not found");

    // Validate sub-category if provided
    let validSubCategoryId = null;
    if (sub_category_id && mongoose.Types.ObjectId.isValid(sub_category_id)) {
      const subCategory = await SubCategory.findOne({
        _id: sub_category_id,
        category: category_id,
        isDeleted: false,
      });
      if (subCategory) {
        validSubCategoryId = subCategory._id;
      }
    }

    // Normalize purpose
    let cleanPurpose = String(purpose || "sale").toLowerCase().trim();
    if (cleanPurpose.includes("rent")) cleanPurpose = "rent";
    else if (cleanPurpose.includes("lease")) cleanPurpose = "lease";
    else cleanPurpose = "sale";

    // Normalize price period
    const validPeriods = ["monthly", "yearly", "weekly", "one-time"];
    let cleanPeriod = String(price_period || "one-time").toLowerCase().trim();
    if (!validPeriods.includes(cleanPeriod)) {
      cleanPeriod = cleanPurpose === "sale" ? "one-time" : "yearly";
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

    // Generate unique slug
    let baseSlug =
      slugify(title || "property", { lower: true, strict: true }) || "property";
    let slug = baseSlug;
    let counter = 1;
    while (await PropertyListing.findOne({ slug })) {
      slug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}${counter > 1 ? `-${counter}` : ""}`;
      counter++;
    }

    const validPayments = toArray(payments).filter((p) =>
      mongoose.Types.ObjectId.isValid(p),
    );

    const listing = await PropertyListing.create({
      category: category_id,
      subCategory: validSubCategoryId,
      soldBy: soldBy || "owner",
      title,
      description,
      purpose: cleanPurpose,
      price: {
        amount: price_amount ? Number(price_amount) : null,
        currency: price_currency || "AED",
        isNegotiable: price_negotiable,
        period: cleanPeriod,
      },
      area: {
        size: area_size ? Number(area_size) : null,
        unit: area_unit || "sqft",
      },
      paymentModes: validPayments,
      additionalFields: validated,
      cae_number: cae_number || null,
      slug,
      stepCompleted: 1,
      isVerified: false,
      isPublished: false,
      isSold: false,
      createdBy: req.user?.id || null,
      leadStatus: "new",
      provider: "user",
    });

    // Update User statistics
    if (req.user?.id) {
      await User.findByIdAndUpdate(req.user.id, {
        $inc: {
          statistics_totalListings: 1,
          statistics_PropertiesListings: 1,
          statistics_activeListings: 1,
        },
      });
    }

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
    return errorData(
      res,
      500,
      false,
      error?.message || "Internal server error",
    );
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
    const user = await User.findById(req.user.id);
    const userRole = user.roles.includes(1);

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
      /* ── STEP 1 – PROPERTY INFO ── */
      case 1: {
        const {
          category_id,
          sub_category_id,
          soldBy,
          title,
          description,
          purpose,
          price_amount,
          price_currency = "AED",
          price_negotiable = false,
          price_period = "one-time",
          area_size,
          area_unit = "sqft",
          cae_number,
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
          let baseSlug =
            slugify(title, { lower: true, strict: true }) || "property";
          let slug = baseSlug;
          let counter = 1;
          while (
            await PropertyListing.findOne({
              slug,
              _id: { $ne: listing._id },
            })
          ) {
            slug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}${counter > 1 ? `-${counter}` : ""}`;
            counter++;
          }
          listing.slug = slug;
        }

        if (category_id && mongoose.Types.ObjectId.isValid(category_id)) {
          listing.category = category_id;
        }
        if (sub_category_id !== undefined) {
          listing.subCategory =
            sub_category_id && mongoose.Types.ObjectId.isValid(sub_category_id)
              ? sub_category_id
              : null;
        }
        if (description !== undefined) listing.description = description;
        if (purpose !== undefined) {
          let cleanPurpose = String(purpose).toLowerCase().trim();
          if (cleanPurpose.includes("rent")) cleanPurpose = "rent";
          else if (cleanPurpose.includes("lease")) cleanPurpose = "lease";
          else cleanPurpose = "sale";
          listing.purpose = cleanPurpose;
        }

        const validPeriods = ["monthly", "yearly", "weekly", "one-time"];
        let cleanPeriod = String(
          price_period || listing.price?.period || "one-time",
        )
          .toLowerCase()
          .trim();
        if (!validPeriods.includes(cleanPeriod)) {
          cleanPeriod = listing.purpose === "sale" ? "one-time" : "yearly";
        }

        listing.price = {
          amount: price_amount ? Number(price_amount) : null,
          currency: price_currency || listing.price?.currency || "AED",
          isNegotiable:
            price_negotiable !== undefined
              ? price_negotiable
              : listing.price?.isNegotiable,
          period: cleanPeriod,
        };
        listing.area = {
          size: area_size ? Number(area_size) : null,
          unit: area_unit || "sqft",
        };
        listing.soldBy = soldBy || listing.soldBy;
        listing.cae_number = cae_number || listing.cae_number;
        if (payments && payments.length > 0) {
          listing.paymentModes = toArray(payments).filter((p) =>
            mongoose.Types.ObjectId.isValid(p),
          );
        }
        listing.additionalFields = validated;
        break;
      }

      /* ── STEP 2 – MEDIA (IMAGES) ── */
      case 2: {
        let retainedImages = [];
        if (req.body.existing_images) {
          try {
            retainedImages =
              typeof req.body.existing_images === "string"
                ? JSON.parse(req.body.existing_images)
                : req.body.existing_images;
          } catch {
            retainedImages = [];
          }
        }

        retainedImages = (
          Array.isArray(retainedImages) ? retainedImages : []
        )
          .map((img) => {
            if (!img || typeof img !== "string") return null;
            return img.replace(/^https?:\/\/[^\/]+\/(api\/)?/, "");
          })
          .filter(Boolean);

        const newImages =
          req.files?.images?.length > 0
            ? req.files.images.map((img) => img.path)
            : [];

        if (retainedImages.length === 0 && newImages.length === 0) {
          if (!listing.images || listing.images.length === 0) {
            return errorData(
              res,
              400,
              false,
              "Please provide at least one image",
            );
          }
        } else {
          listing.images = [...retainedImages, ...newImages];
        }
        break;
      }

      /* ── STEP 3 – CONTACT DETAILS ── */
      case 3: {
        listing.contactPersonName = req.body.name || null;
        listing.email = req.body.email || null;
        const normalizeCc = (code) => {
          if (!code) return null;
          const s = String(code).trim();
          if (!s) return null;
          return s.startsWith("+") ? s : `+${s.replace(/\D/g, "")}`;
        };
        listing.countryCode = normalizeCc(req.body.country_code) || "+971";
        listing.mobileNumber = req.body.mobile_number || null;
        listing.altCountryCode = normalizeCc(req.body.alt_country_code);
        listing.alternateMobileNumber = req.body.second_mobile_number || null;
        listing.city = req.body.city_id || null;
        listing.location = {
          address: req.body.address || null,
          locality: req.body.locality || null,
          mapLat: req.body.map_lat ? Number(req.body.map_lat) : null,
          mapLng: req.body.map_lng ? Number(req.body.map_lng) : null,
        };

        // Update cityNameLower
        if (listing.city) {
          const cityDoc = await CitiesSchema.findById(listing.city);
          listing.cityNameLower = cityDoc?.name?.toLowerCase() || "";
        }
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

    if (listing.city) {
      const cityDoc = await CitiesSchema.findById(listing.city);
      listing.cityNameLower = cityDoc?.name?.toLowerCase() || "";
    }

    await listing.save();

    return successData(res, 200, true, `Step ${step} saved successfully`, {
      id: listing._id,
      slug: listing.slug,
      stepCompleted: listing.stepCompleted,
    });
  } catch (error) {
    console.warn("Update property listing step error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── UPDATE LEAD STATUS ──────────────────────────────────────────────────────
export const updateLeadStatus = async (req, res) => {
  try {
    const { listingId } = req.params;
    const { leadStatus } = req.body;

    const VALID_LEAD_STATUSES = ["hot", "warm", "cold", "new"];
    if (!VALID_LEAD_STATUSES.includes(leadStatus)) {
      return errorData(res, 400, false, "Invalid lead status");
    }

    const listing = await PropertyListing.findByIdAndUpdate(
      listingId,
      { leadStatus },
      { new: true },
    );

    if (!listing) return errorData(res, 404, false, "Listing not found");

    return successData(res, 200, true, "Lead status updated", {
      id: listing._id,
      leadStatus: listing.leadStatus,
    });
  } catch (error) {
    console.warn("Update lead status error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── UPSERT ADDITIONAL FIELDS ────────────────────────────────────────────────
export const upsertAdditionalFields = async (req, res) => {
  try {
    const { listingId } = req.params;
    const { additional_fields = [] } = req.body;

    const listing = await PropertyListing.findOne({
      _id: listingId,
      isDeleted: false,
    });
    if (!listing) return errorData(res, 404, false, "Listing not found");

    const user = await User.findById(req.user.id);
    const isAdmin = user?.roles?.includes(1);
    if (listing.createdBy?.toString() !== req.user.id.toString() && !isAdmin) {
      return errorData(res, 403, false, "Forbidden");
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

    listing.additionalFields = validated;
    await listing.save();

    return successData(res, 200, true, "Additional fields updated", {
      id: listing._id,
      additionalFields: listing.additionalFields,
    });
  } catch (error) {
    console.warn("Upsert additional fields error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* ── GET ALL (paginated + filtered) ── */
export const getAllPropertiesWithPaginationAndFilters = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // ✅ DEBUG: Log what's actually coming in
    console.log("Query Params Received:", req.query);

    // Base filter — only non-deleted
    const filter = { isDeleted: false };

    // Role filter
    if (req.query.role && req.query.role !== "all") {
      const roleNum = Number(req.query.role);
      if (!isNaN(roleNum)) {
        const roleUserIds = await User.distinct("_id", {
          $or: [{ roles: roleNum }, { role: roleNum }],
        });
        filter.createdBy = { $in: roleUserIds };
      }
    }

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

    if (req.query.payment_mode_id) {
      const ids = req.query.payment_mode_id
        .split(",")
        .filter(Boolean)
        .map((id) => new mongoose.Types.ObjectId(id.trim()));
      filter.paymentModes = { $in: ids };
    }

    // ✅ Purpose / Listing Type (Handle numeric IDs or strings)
    const purposeVal = req.query.purpose || req.query.rent_or_sell;
    if (purposeVal) {
      const purposeMap = { 1: "rent", 2: "sale", 3: "lease" };
      filter.purpose = purposeMap[purposeVal] || purposeVal;
    }

    // ✅ Price Range Filter
    if (req.query.price_min || req.query.price_max) {
      filter["price.amount"] = {};
      if (req.query.price_min)
        filter["price.amount"].$gte = Number(req.query.price_min);
      if (req.query.price_max)
        filter["price.amount"].$lte = Number(req.query.price_max);
    }

    // ✅ Beds, Baths, Furnishing (stored in additionalFields)
    // const additionalFilters = [];
    // if (req.query.beds) {
    //   // Handle both "1" and "1 BHK" styles by using regex or direct match if known
    //   additionalFilters.push({
    //     additionalFields: {
    //       $elemMatch: {
    //         field_label: /bed/i,
    //         value: { $regex: new RegExp(`^${req.query.beds}`, "i") }
    //       }
    //     }
    //   });
    // }
    // if (req.query.baths) {
    //   additionalFilters.push({
    //     additionalFields: {
    //       $elemMatch: {
    //         field_label: /bath/i,
    //         value: { $regex: new RegExp(`^${req.query.baths}`, "i") }
    //       }
    //     }
    //   });
    // }
    // if (req.query.furnishing) {
    //   additionalFilters.push({
    //     additionalFields: {
    //       $elemMatch: {
    //         field_label: /furnish/i,
    //         value: req.query.furnishing
    //       }
    //     }
    //   });
    // }

    // if (additionalFilters.length > 0) {
    //   filter.$and = filter.$and || [];
    //   filter.$and.push(...additionalFilters);
    // }

    // ✅ Search Filter (Improved)
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, "i");
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { "location.address": searchRegex },
        { "location.locality": searchRegex },
      ];
    }

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
      PropertyListing.find(filter)
        .populate("category", "name")
        .populate("subCategory", "name")
        .populate("city", "name")
        .populate("plan", "name")
        .populate("createdBy", "name email phone country_code roles")
        .populate("approvedBy", "name email phone country_code")
        .populate("rejectedBy", "name email phone country_code")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PropertyListing.countDocuments(filter),
      PropertyListing.countDocuments({ isDeleted: false }),
      PropertyListing.countDocuments({ isDeleted: false, status: "pending" }), // ✅
      PropertyListing.countDocuments({ isDeleted: false, status: "approved" }), // ✅
      PropertyListing.countDocuments({ isDeleted: false, status: "rejected" }), // ✅
    ]);

    // console.log("properties", properties);
    // console.log("total", total);
    // console.log("totalAll", totalAll);
    // console.log("totalPending", totalPending);
    // console.log("totalApproved", totalApproved);
    // console.log("totalRejected", totalRejected);

    // ✅ Return empty array instead of 404 — better UX for filtered results
    return successData(res, 200, true, "Properties fetched successfully", {
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
    console.error("Property fetch error:", error);
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
      .populate({
        path: "additionalFields.field_id",
        match: { is_deleted: false, is_active: true },
        select: "field_label field_type is_deleted is_active",
      })
      .lean();

    if (!listing) return errorData(res, 404, false, "Listing not found");

    if (Array.isArray(listing.additionalFields)) {
      listing.additionalFields = listing.additionalFields.filter(
        (f) =>
          f.field_id != null &&
          !f.field_id.is_deleted &&
          f.field_id.is_active !== false &&
          f.value !== null &&
          f.value !== undefined &&
          f.value !== "" &&
          (!Array.isArray(f.value) || f.value.length > 0) &&
          (typeof f.value !== "object" ||
            Array.isArray(f.value) ||
            (f.value.amount && f.value.amount.toString().trim() !== "")),
      );
    }

    return successData(res, 200, true, "Listing fetched successfully", listing);
  } catch (error) {
    console.warn("Property listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// get property by user
export const getPropertyListingByUser = async (req, res) => {
  console.log("req.user get property by user", req.user);
  try {
    const id = req.user?.id;
    if (!id) return errorData(res, 400, false, "Id is required");

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // const listing = await PropertyListing.find({
    //   createdBy: id,
    //   isDeleted: false,
    // })
    //   .populate("category", "name")
    //   .populate("subCategory", "name")
    //   .populate("city", "name")
    //   .populate("additionalFields.field_id", "field_label field_type")
    //   .lean();

    const [
      listings,
      total,
      pendingCount,
      approvedCount,
      rejectedCount,
      publishedCount,
      verifiedCount,
    ] = await Promise.all([
      PropertyListing.find({
        createdBy: id,
        isDeleted: false,
      })
        .populate("category", "name iconSvg")
        .populate("subCategory", "name")
        .populate("city", "name")
        .populate("plan", "name")
        .populate({
          path: "additionalFields.field_id",
          match: { is_deleted: false, is_active: true },
          select: "field_label field_type is_deleted is_active",
        })
        .populate("createdBy", "name email phone avatar") // optional: show owner info
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PropertyListing.countDocuments({
        createdBy: id,
        isDeleted: false,
      }),
      PropertyListing.countDocuments({
        createdBy: id,
        isDeleted: false,
        status: "pending",
      }),
      PropertyListing.countDocuments({
        createdBy: id,
        isDeleted: false,
        status: "approved",
      }),
      PropertyListing.countDocuments({
        createdBy: id,
        isDeleted: false,
        status: "rejected",
      }),
      PropertyListing.countDocuments({
        createdBy: id,
        isDeleted: false,
        isPublished: true,
      }),
      PropertyListing.countDocuments({
        createdBy: id,
        isDeleted: false,
        isVerified: true,
      }),
    ]);

    if (!listings.length && page === 1)
      return errorData(res, 404, false, "No listings found for this user");

    return successData(res, 200, true, "Listings fetched successfully", {
      total,
      statistics: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        published: publishedCount,
        verified: verifiedCount,
      },
      listings,
    });
  } catch (error) {
    console.warn("Property listing fetch error:", error);
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
    console.warn("Mark as sold error:", error);
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

    googleIndexingService.notify(
      `${APP_BASE_URL}/property/${listing.slug}`,
      "URL_DELETED",
    );

    // Update User statistics
    if (listing.createdBy) {
      await User.findByIdAndUpdate(listing.createdBy, {
        $inc: {
          statistics_activeListings: -1,
          statistics_totalListings: -1,
          statistics_PropertiesListings: -1,
        },
      });
    }

    return successData(res, 200, true, "Listing deleted successfully", {
      id: listing._id,
    });
  } catch (error) {
    console.warn("Property listing delete error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── controllers/propertyListingController.js ────────────────────────────────
export const updatePropertyListingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const adminId = req.user._id;

    // ── Validate status value ─────────────────────────────────────────────
    const allowedStatuses = ["approved", "rejected", "unapproved"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'approved', 'rejected', or 'unapproved'",
      });
    }

    // ── Rejection must have a reason ──────────────────────────────────────
    if (status === "rejected" && !rejectionReason?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when rejecting a listing",
      });
    }

    // ── Find the listing ──────────────────────────────────────────────────
    const listing = await PropertyListing.findById(id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Property listing not found",
      });
    }

    // ── Update fields based on status ─────────────────────────────────────
    if (status === "approved") {
      listing.status = "approved";
      listing.approvedBy = adminId;
      listing.rejectedBy = null;
      listing.rejectionReason = null;
      googleIndexingService.notify(
        `${APP_BASE_URL}/properties/${listing.slug}`,
        "URL_UPDATED",
      );
    } else if (status === "rejected") {
      listing.status = "rejected";
      listing.rejectedBy = adminId;
      listing.rejectionReason = rejectionReason.trim();
      listing.approvedBy = null;
      googleIndexingService.notify(
        `${APP_BASE_URL}/properties/${listing.slug}`,
        "URL_DELETED",
      );
    } else if (status === "unapproved") {
      listing.status = "pending";
      listing.approvedBy = null;
      listing.rejectedBy = null;
      listing.rejectionReason = null;
      googleIndexingService.notify(
        `${APP_BASE_URL}/properties/${listing.slug}`,
        "URL_DELETED",
      );
    }

    await listing.save();

    // ── Send notification mail & push ────────────────────────────────────
    // Skip notification for "unapproved" (admin internal reset, no user-facing change)
    if (status !== "unapproved") {
      let userDoc = null;
      if (listing.createdBy) {
        try {
          userDoc = await User.findById(listing.createdBy);
        } catch (uErr) {
          console.warn("Could not fetch userDoc for property listing:", uErr.message);
        }
      }

      const shouldSendEmail = req.body.sendEmail !== false;
      const targetEmail = listing.email || userDoc?.email;

      if (shouldSendEmail && targetEmail) {
        try {
          await sendApprovedAndRejectedListingMail(
            targetEmail,
            listing.title,
            status,
            status === "rejected" ? rejectionReason.trim() : null,
          );
          console.log(`✅ Mail sent to ${targetEmail} for status: ${status}`);

          if (listing.createdBy) {
            const pushTitle =
              status === "approved"
                ? "Property Approved 🎉"
                : "Property Rejected ❌";
            const pushBody =
              status === "approved"
                ? `Congratulations! Your property listing "${listing.title}" has been successfully approved.`
                : `We're sorry, your property listing "${listing.title}" was rejected. ${rejectionReason ? "Reason: " + rejectionReason.trim() : ""}`;

            await sendPushNotification(listing.createdBy, pushTitle, pushBody, {
              type: "PROPERTY_LISTING_STATUS",
              listingId: listing._id.toString(),
              status: status,
            });
          }
        } catch (mailError) {
          console.error("❌ Mail/Notification send failed:", mailError.message);
        }
      }

      // ── Send WhatsApp Message ──
      const shouldSendWhatsapp = req.body.sendWhatsapp !== false;

      if (shouldSendWhatsapp) {
        try {
          const phone =
            req.body.whatsappPhone ||
            listing.phone ||
            listing.mobileNumber ||
            listing.contactPhone ||
            listing.contactPersonPhone ||
            userDoc?.mobileNumber ||
            userDoc?.phoneNumber;

          const rawCc = String(
            req.body.whatsappCountryCode ||
            listing.countryCode ||
            userDoc?.countryCode ||
            "+971"
          ).trim();
          const countryCode = rawCc.startsWith("+") ? rawCc : `+${rawCc.replace(/\D/g, "")}`;

          const recipientName = listing.contactPersonName || listing.ownerName || userDoc?.name || listing.title || "User";
          let text = req.body.whatsappMessage;
          if (!text) {
            if (status === "approved") {
              text = `Hello *${recipientName}*, 🏠 Congratulations! Your property listing *"${listing.title}"* has been approved and is now live on AddressGuru UAE!\n\n📍 *View Live Listing:* ${APP_BASE_URL}/properties/${listing.slug}\n👉 *Dashboard:* ${APP_BASE_URL}/dashboard\n\nThank you for choosing AddressGuru UAE!`;
            } else if (status === "rejected") {
              text = `Hello *${recipientName}*, your property listing *"${listing.title}"* on AddressGuru UAE requires updates.\n\n❌ *Reason:* ${rejectionReason ? rejectionReason.trim() : "Please review property guidelines"}\n👉 *Dashboard:* ${APP_BASE_URL}/dashboard\n\nPlease update your listing so we can review it again.`;
            }
          }

          if (phone && text) {
            await sendTextMessage({
              to: phone,
              message: text,
              countryCode,
              mediaUrl: req.body.mediaUrl || null,
              mediaType: req.body.mediaType || "document",
            });
            console.log(`✅ WhatsApp ${status} message sent for property to ${phone}`);
          }
        } catch (waErr) {
          console.warn("❌ WhatsApp send failed in updatePropertyListingStatus:", waErr.message);
        }
      }
    }

    // ── Populate & respond ────────────────────────────────────────────────
    await listing.populate("approvedBy rejectedBy", "name email");

    return res.status(200).json({
      success: true,
      message: `Property listing ${status === "unapproved" ? "moved back to pending" : status} successfully`,
      data: {
        _id: listing._id,
        title: listing.title,
        status: listing.status,
        approvedBy: listing.approvedBy,
        rejectedBy: listing.rejectedBy,
        rejectionReason: listing.rejectionReason,
      },
    });
  } catch (error) {
    console.error("updatePropertyListingStatus error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET ADMIN COMPLETED LISTINGS ────────────────────────────────────────────
export const getAdminCompletedListings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
      isDeleted: false,
      stepCompleted: 5,
    };

    if (req.query.status) filter.status = req.query.status;

    if (req.query.role && req.query.role !== "all") {
      const roleNum = Number(req.query.role);
      if (!isNaN(roleNum)) {
        const roleUserIds = await User.distinct("_id", {
          $or: [{ roles: roleNum }, { role: roleNum }],
        });
        filter.createdBy = { $in: roleUserIds };
      }
    }

    const [listings, total] = await Promise.all([
      PropertyListing.find(filter)
        .populate("category", "name")
        .populate("city", "name")
        .populate("createdBy", "name email phone country_code roles")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PropertyListing.countDocuments(filter),
    ]);

    return successData(res, 200, true, "Admin listings fetched successfully", {
      listings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.warn("Get admin listings error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// get approved listings with pagination
export const getApprovedListings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const listings = await PropertyListing.find({ status: "approved" })
      .populate("category", "name")
      .populate("subCategory", "name")
      .populate("city", "name")
      .populate({
        path: "additionalFields.field_id",
        match: { is_deleted: false, is_active: true },
        select: "field_label field_type is_deleted is_active",
      })
      .skip(skip)
      .limit(limit)
      .lean();

    if (!listings.length)
      return errorData(res, 404, false, "No listings found");

    return successData(res, 200, true, "Listings fetched successfully", {
      listings,
      page,
      limit,
      total: listings.length,
    });
  } catch (error) {
    console.error("Property listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── PUBLISH LISTING BY USER/ADMIN ───────────────────────────────────────────
export const publishListing = async (req, res) => {
  try {
    const { identifier } = req.params;
    const isObjectId = identifier.match(/^[0-9a-fA-F]{24}$/);

    const listing = await PropertyListing.findOne({
      $or: [
        { _id: isObjectId ? identifier : undefined },
        { slug: identifier },
      ].filter(Boolean),
      isDeleted: false,
    });

    if (!listing) return errorData(res, 404, false, "Listing not found");

    // Ownership check
    const userRole = req.user?.roles?.includes(1);
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

    listing.isPublished = true;
    await listing.save();

    // Notify Google indexing (Keeping commented as per user's manual edits)
    // try {
    //   googleIndexingService.notify(`${APP_BASE_URL}/property/${listing.slug}`, "URL_UPDATED");
    // } catch (err) {
    //   console.warn("Google Indexing notify failed:", err);
    // }

    return successData(res, 200, true, "Listing published successfully", {
      id: listing._id,
      isPublished: listing.isPublished,
    });
  } catch (error) {
    console.warn("Listing publish error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── UNPUBLISH LISTING BY USER/ADMIN ─────────────────────────────────────────
export const unpublishListing = async (req, res) => {
  try {
    const { identifier } = req.params;
    const isObjectId = identifier.match(/^[0-9a-fA-F]{24}$/);

    const listing = await PropertyListing.findOne({
      $or: [
        { _id: isObjectId ? identifier : undefined },
        { slug: identifier },
      ].filter(Boolean),
      isDeleted: false,
    });

    if (!listing) return errorData(res, 404, false, "Listing not found");

    // Ownership check
    const userRole = req.user?.roles?.includes(1);
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

    listing.isPublished = false;
    await listing.save();

    // Notify Google indexing (Keeping commented as per user's manual edits)
    // try {
    //   googleIndexingService.notify(`${APP_BASE_URL}/property/${listing.slug}`, "URL_DELETED");
    // } catch (err) {
    //   console.warn("Google Indexing notify failed:", err);
    // }

    return successData(res, 200, true, "Listing unpublished successfully", {
      id: listing._id,
      isPublished: listing.isPublished,
    });
  } catch (error) {
    console.warn("Listing unpublish error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// property additional field
export const getPropertyAdditionalFields = async (req, res) => {
  try {
    const { category_id } = req.params;
    const { subcategory_id } = req.query;

    if (!category_id) {
      return errorData(res, 400, false, "Category id is required");
    }

    const filter = {
      category_id,
      is_deleted: false,
      is_active: true,
      ...(subcategory_id && { subcategory_id }),
    };

    const additionalFields = await AdditionalField.find(filter).sort({
      createdAt: 1,
    });

    return successData(
      res,
      200,
      true,
      "Property additional fields fetched successfully",
      additionalFields,
    );
  } catch (error) {
    console.warn("Property additional fields fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};
