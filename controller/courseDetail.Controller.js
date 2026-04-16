import CourseDetail from "../model/courseDetailSchema.js";
import BusinessListing from "../model/businessListingSchema.js";
import mongoose from "mongoose";
import { successData, errorData } from "../services/helper.js";

// ─── helpers ────────────────────────────────────────────────────────────────

async function assertOwnership(listingId, userId) {
  const listing = await BusinessListing.findOne({
    _id: listingId,
    isDeleted: false,
  });

  if (!listing) {
    throw { status: 404, message: "Business listing not found." };
  }

  if (listing.createdBy.toString() !== userId.toString()) {
    throw {
      status: 403,
      message: "You are not authorised to manage this listing.",
    };
  }

  return listing;
}

// ─── CONTROLLERS ────────────────────────────────────────────────────────────

// ✅ CREATE
export const createCourseDetail = async (req, res) => {
  try {
    const userId = req.user.id;

    const { feature, listing, category, duration, price } = req.body;

    if (!feature || !listing || !category || !duration || price == null) {
      return errorData(
        res,
        400,
        false,
        "feature, listing, category, duration and price are required."
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(feature) ||
      !mongoose.Types.ObjectId.isValid(listing) ||
      !mongoose.Types.ObjectId.isValid(category)
    ) {
      return errorData(res, 400, false, "Invalid IDs provided.");
    }

    await assertOwnership(listing, userId);

    const course = await CourseDetail.create({
      feature,
      listing,
      category,
      duration,
      price,
    });

    return successData(
      res,
      201,
      true,
      "Course detail created successfully.",
      course
    );
  } catch (err) {
    if (err.code === 11000) {
      return errorData(
        res,
        400,
        false,
        "Duplicate course entry for this feature, listing and category."
      );
    }
    if (err.status) return errorData(res, err.status, false, err.message);

    console.error("createCourseDetail:", err);
    return errorData(res, 500, false, "Internal server error.");
  }
};

// ✅ GET by listing slug
export const getCoursesByListingSlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const listing = await BusinessListing.findOne({
      slug,
      isDeleted: false,
    });

    if (!listing) {
      return errorData(res, 404, false, "Listing not found.");
    }

    const courses = await CourseDetail.find({
      listing: listing._id,
      isDeleted: false,
    })
      .populate("feature")
      .populate("category")
      .sort({ createdAt: 1 });

    return successData(
      res,
      200,
      true,
      "Course details fetched successfully.",
      courses
    );
  } catch (err) {
    console.error("getCoursesByListingSlug:", err);
    return errorData(res, 500, false, "Internal server error.");
  }
};

// ✅ GET by ID
export const getCourseById = async (req, res) => {
  try {
    const course = await CourseDetail.findOne({
      _id: req.params.id,
      isDeleted: false,
    })
      .populate("feature")
      .populate("category")
      .populate("listing", "businessName slug");

    if (!course) {
      return errorData(res, 404, false, "Course not found.");
    }

    return successData(
      res,
      200,
      true,
      "Course fetched successfully.",
      course
    );
  } catch (err) {
    console.error("getCourseById:", err);
    return errorData(res, 500, false, "Internal server error.");
  }
};

// ✅ UPDATE
export const updateCourseDetail = async (req, res) => {
  try {
    const userId = req.user.id;

    const course = await CourseDetail.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!course) {
      return errorData(res, 404, false, "Course not found.");
    }

    await assertOwnership(course.listing, userId);

    const { feature, category, duration, price } = req.body;

    if (feature !== undefined) course.feature = feature;
    if (category !== undefined) course.category = category;
    if (duration !== undefined) course.duration = duration;
    if (price !== undefined) course.price = price;

    await course.save();

    return successData(
      res,
      200,
      true,
      "Course updated successfully.",
      course
    );
  } catch (err) {
    if (err.code === 11000) {
      return errorData(
        res,
        400,
        false,
        "Duplicate course entry for this combination."
      );
    }
    if (err.status) return errorData(res, err.status, false, err.message);

    console.error("updateCourseDetail:", err);
    return errorData(res, 500, false, "Internal server error.");
  }
};

// ✅ SOFT DELETE
export const deleteCourseDetail = async (req, res) => {
  try {
    const userId = req.user.id;

    const course = await CourseDetail.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!course) {
      return errorData(res, 404, false, "Course not found.");
    }

    await assertOwnership(course.listing, userId);

    course.isDeleted = true;
    await course.save();

    return successData(
      res,
      200,
      true,
      "Course deleted successfully.",
      null
    );
  } catch (err) {
    if (err.status) return errorData(res, err.status, false, err.message);

    console.error("deleteCourseDetail:", err);
    return errorData(res, 500, false, "Internal server error.");
  }
};