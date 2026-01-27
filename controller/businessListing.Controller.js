import Listing from "../model/businessListingSchema.js";
import slugify from "slugify";
import { successData, errorData } from "../services/helper.js";

export const saveListingStep = async (req, res) => {
  try {
    const { step, listing_id, } = req.body;

    if (!step)
      return errorData(res, 400, false, "Step number is required");

    /* =========================
       STEP 1 – CREATE LISTING
    ========================== */
    if (Number(step) === 1) {
      const {
        category_id,
        sub_category_id,
        city,
        business_name,
        business_address,
        ad_description,
        facilities = [],
        services = [],
        payments = [],
        hours,
      } = req.body;

      if (!category_id || !city || !business_name || !business_address)
        return errorData(
          res,
          400,
          false,
          "Required fields are missing"
        );

      const slug = slugify(business_name, { lower: true, strict: true });

      const listing = await Listing.create({
        category: category_id,
        subCategory: sub_category_id || null,
        city,
        businessName: business_name,
        businessAddress: business_address,
        description: ad_description,
        facilities,
        services,
        paymentModes: payments,
        workingHours: hours ? JSON.parse(hours) : null,
        slug,
        stepCompleted: 1,
        isDraft: true,
      });

      return successData(
        res,
        200,
        true,
        "Listing created successfully",
        {
          id: listing._id,
          slug: listing.slug,
        }
      );
    }

    /* =========================
       VALIDATE LISTING ID
    ========================== */
    if (!listing_id)
      return errorData(res, 400, false, "Listing ID is required");

    const listing = await Listing.findOne({
      _id: listing_id,
      isDeleted: false,
    });

    if (!listing)
      return errorData(res, 404, false, "Listing not found");

    /* =========================
       STEP 2 – SOCIAL LINKS
    ========================== */
    if (Number(step) === 2) {
      listing.websiteLink = req.body.website_link || listing.websiteLink;
      listing.videoLink = req.body.video_link || listing.videoLink;
    }

    /* =========================
       STEP 3 – CONTACT DETAILS
    ========================== */
    if (Number(step) === 3) {
      listing.contactPersonName = req.body.name;
      listing.email = req.body.email;
      listing.mobileNumber = req.body.mobile_number;
      listing.alternateMobileNumber =
        req.body.second_mobile_number || null;
      listing.locality = req.body.locality;
    }

    /* =========================
       STEP 4 – SEO
    ========================== */
    if (Number(step) === 4) {
      listing.seo = {
        title: req.body.seo_title,
        description: req.body.seo_description,
      };
    }

    /* =========================
       STEP 5 – MEDIA
    ========================== */
    if (Number(step) === 5) {
      if (req.files?.logo) {
        listing.logo = req.files.logo[0].path;
      }

      if (req.files?.images?.length > 0) {
        const newImages = req.files.images.map((img) => img.path);
        listing.images = [...listing.images, ...newImages];
      }
    }

    /* =========================
       STEP 6 – PLAN & PUBLISH
    ========================== */
    if (Number(step) === 6) {
      listing.plan = req.body.plan_id;
      listing.isDraft = false;
      listing.isPublished = true;
    }

    listing.stepCompleted = Math.max(listing.stepCompleted, Number(step));
    await listing.save();

    return successData(
      res,
      200,
      true,
      `Step ${step} saved successfully`,
      {
        id: listing._id,
        stepCompleted: listing.stepCompleted,
      }
    );
  } catch (error) {
    console.error("Listing step error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};
