import MarketplaceListing from "../model/marketplaceListingSchema.js";
import AdditionalField from "../model/additionalFieldSchema.js";
import Category from "../model/categoriesSchema.js";
import SubCategory from "../model/subCategoriesSchema.js";
import User from "../model/userSchema.js";
import City from "../model/CitiesSchema.js";
import slugify from "slugify";
import { successData, errorData } from "../services/helper.js";
import googleIndexingService from "../services/googleIndexing.service.js";
import { APP_BASE_URL } from "../services/constant.js";
import { sendApprovedAndRejectedListingMail } from "../utils/sendMail.js";
import { sendPushNotification } from "../services/notification.service.js";

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

// ─── POST /marketplace-listings ───────────────────────────────────────────────
export const createMarketplaceListing = async (req, res) => {
  console.log("req.user in marketplace", req.user);
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

    const slug = `${slugify(title, { lower: true, strict: true })}`;

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
      createdBy: req.user?.id || null,
    });

    // Update User statistics
    if (req.user?.id) {
      await User.findByIdAndUpdate(req.user.id, {
        $inc: {
          statistics_totalListings: 1,
          statistics_ProductListings: 1,
          statistics_marketPlaceListings: 1,
          statistics_activeListings: 1,
        },
      });
    }

    return successData(res, 201, true, "Listing created successfully", {
      id: listing._id,
      slug: listing.slug,
    });
  } catch (error) {
    console.warn("Create marketplace listing error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── PUT /marketplace-listings/:slug/step/:step ───────────────────────────────
export const updateMarketplaceListingStep = async (req, res) => {
  try {
    const { slug, step } = req.params;

    const listing = await MarketplaceListing.findOne({
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
      !userRole // ← admin bypass added
    ) {
      return errorData(
        res,
        403,
        false,
        "Forbidden: you do not own this listing",
      );
    }

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

        if (category_id) {
          const category = await Category.findOne({
            _id: category_id,
            isDeleted: false,
          });
          if (!category)
            return errorData(res, 404, false, "Category not found");
        }

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

        if (title && title !== listing.title) {
          listing.title = title;
          listing.slug = `${slugify(title, { lower: true, strict: true })}`;
        }

        if (category_id) listing.category = category_id;
        listing.subCategory = sub_category_id || null;
        if (description !== undefined) listing.description = description;
        if (condition !== undefined) listing.condition = condition;
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
        googleIndexingService.notify(
          `${APP_BASE_URL}/marketplace/${listing.slug}`,
          "URL_UPDATED",
        );
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
    console.warn("Update marketplace listing step error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* ── GET ALL (paginated + filtered) ── */
export const getAllMarketplaceListings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // ✅ DEBUG: Log what's actually coming in
    console.log("Query Params Received:", req.query);

    // Base filter — only non-deleted listings
    const filter = { isDeleted: false };

    // Optional filters from query params
    if (req.query.condition) filter.condition = req.query.condition;
    
    // City filter - support city_id or city (slug/name)
    if (req.query.city_id) {
      filter.city = req.query.city_id;
    } else if (req.query.city) {
      const cityDoc = await City.findOne({
        $or: [
          { slug: req.query.city.toLowerCase() },
          { name: new RegExp(`^${req.query.city}$`, "i") },
        ],
      });
      if (cityDoc) {
        filter.city = cityDoc._id;
      }
    }

    if (req.query.category_id) filter.category = req.query.category_id;
    if (req.query.sub_category_id)
      filter.subCategory = req.query.sub_category_id;
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

    // Free items toggle
    if (req.query.is_free === "true") filter["price.isFree"] = true;

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
      MarketplaceListing.find(filter)
        .populate("category", "name")
        .populate("subCategory", "name")
        .populate("city", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MarketplaceListing.countDocuments(filter),
      MarketplaceListing.countDocuments({ isDeleted: false }),
      MarketplaceListing.countDocuments({
        isDeleted: false,
        status: "pending",
      }), // ✅
      MarketplaceListing.countDocuments({
        isDeleted: false,
        status: "approved",
      }), // ✅
      MarketplaceListing.countDocuments({
        isDeleted: false,
        status: "rejected",
      }), // ✅
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
    console.warn("Marketplace listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* ── GET SINGLE BY SLUG ── */
export const getMarketplaceListingBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return errorData(res, 400, false, "Slug is required");

    const listing = await MarketplaceListing.findOne({
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
    console.warn("Marketplace listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

//get listing by user
export const getMarketplaceListingByUser = async (req, res) => {
  console.log("req.user get listing by user", req.user);
  try {
    const id = req.user.id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // const listings = await MarketplaceListing.find({
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
      MarketplaceListing.find({
        createdBy: id,
        isDeleted: false,
      })
        .populate("category", "name iconSvg")
        .populate("subCategory", "name")
        .populate("city", "name")
        .populate("plan", "name")
        .populate("additionalFields.field_id", "field_label field_type")
        .populate("createdBy", "name email phone avatar") // optional: show owner info
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MarketplaceListing.countDocuments({
        createdBy: id,
        isDeleted: false,
      }),
      MarketplaceListing.countDocuments({
        createdBy: id,
        isDeleted: false,
        status: "pending",
      }),
      MarketplaceListing.countDocuments({
        createdBy: id,
        isDeleted: false,
        status: "approved",
      }),
      MarketplaceListing.countDocuments({
        createdBy: id,
        isDeleted: false,
        status: "rejected",
      }),
      MarketplaceListing.countDocuments({
        createdBy: id,
        isDeleted: false,
        isPublished: true,
      }),
      MarketplaceListing.countDocuments({
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
    console.warn("Marketplace listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* ── MARK AS SOLD ── */
export const markMarketplaceListingAsSold = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return errorData(res, 400, false, "Listing id is required");

    const listing = await MarketplaceListing.findOne({
      _id: id,
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

    listing.isSold = true;
    await listing.save();

    // Update User statistics
    if (listing.createdBy) {
      await User.findByIdAndUpdate(listing.createdBy, {
        $inc: { statistics_soldItems: 1 },
      });
    }

    return successData(res, 200, true, "Listing marked as sold", {
      id: listing._id,
    });
  } catch (error) {
    console.warn("Mark as sold error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* ── SOFT DELETE ── */
export const deleteMarketplaceListing = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return errorData(res, 400, false, "Listing id is required");

    const listing = await MarketplaceListing.findOne({
      _id: id,
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
      `${APP_BASE_URL}/marketplace/${listing.slug}`,
      "URL_DELETED",
    );

    // Update User statistics
    if (listing.createdBy) {
      await User.findByIdAndUpdate(listing.createdBy, {
        $inc: {
          statistics_activeListings: -1,
          statistics_totalListings: -1,
          statistics_ProductListings: -1,
          statistics_marketPlaceListings: -1,
        },
      });
    }

    return successData(res, 200, true, "Listing deleted successfully", {
      id: listing._id,
    });
  } catch (error) {
    console.warn("Marketplace listing delete error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// update status
export const updateMarketplaceListingStatus = async (req, res) => {
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
    const listing = await MarketplaceListing.findById(id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    // ── Update fields based on status ─────────────────────────────────────
    // "unapproved" is a UI concept — it maps back to "pending" in the schema
    if (status === "approved") {
      listing.status = "approved";
      listing.approvedBy = adminId;
      listing.rejectedBy = null;
      listing.rejectionReason = null;
    } else if (status === "rejected") {
      listing.status = "rejected";
      listing.rejectedBy = adminId;
      listing.rejectionReason = rejectionReason.trim();
      listing.approvedBy = null;
    } else if (status === "unapproved") {
      // Reset back to pending — clears any prior approval/rejection
      listing.status = "pending";
      listing.approvedBy = null;
      listing.rejectedBy = null;
      listing.rejectionReason = null;
    }

    await listing.save();

    // ── Send notification mail & push ────────────────────────────────────
    // Skip notification for "unapproved" (admin internal action, no user-facing change)
    if (status !== "unapproved") {
      try {
        await sendApprovedAndRejectedListingMail(
          listing.email,
          listing.title, // 👈 product title instead of contactPersonName
          status,
          status === "rejected" ? rejectionReason.trim() : null,
        );
        console.log(`✅ Mail sent to ${listing.email} for status: ${status}`);

        if (listing.createdBy) {
          const pushTitle = status === "approved" ? "Marketplace Listing Approved 🎉" : "Marketplace Listing Rejected ❌";
          const pushBody = status === "approved"
            ? `Congratulations! Your marketplace listing "${listing.title}" has been successfully approved.`
            : `We're sorry, your marketplace listing "${listing.title}" was rejected. ${rejectionReason ? 'Reason: ' + rejectionReason.trim() : ''}`;

          await sendPushNotification(listing.createdBy, pushTitle, pushBody, {
            type: "MARKETPLACE_LISTING_STATUS",
            listingId: listing._id.toString(),
            status: status
          });
        }
      } catch (mailError) {
        console.error("❌ Mail/Notification send failed:", mailError.message);
      }
    }

    // ── Populate & respond ────────────────────────────────────────────────
    await listing.populate("approvedBy rejectedBy", "name email");

    return res.status(200).json({
      success: true,
      message: `Listing ${status === "unapproved" ? "moved back to pending" : status} successfully`,
      data: {
        _id: listing._id,
        title: listing.title, // correct field for MarketplaceListing
        status: listing.status,
        approvedBy: listing.approvedBy,
        rejectedBy: listing.rejectedBy,
        rejectionReason: listing.rejectionReason,
      },
    });
  } catch (error) {
    console.error("updateListingStatus error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// get approved listings with pagination
export const getApprovedListings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const listings = await MarketplaceListing.find({ status: "approved" })
      .populate("category", "name")
      .populate("subCategory", "name")
      .populate("city", "name")
      .populate("additionalFields.field_id", "field_label field_type")
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
    console.error("Marketplace listing fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};
