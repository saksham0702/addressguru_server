// ─── validations/business.validator.js ───────────────────────────────────────
import Joi from "joi";
import mongoose from "mongoose";

const objectIdArray = () =>
  Joi.alternatives()
    .try(Joi.array().items(Joi.any()), Joi.string())
    .custom((value, helpers) => {
      let arr = value;

      if (typeof value === "string") {
        try {
          arr = JSON.parse(value);
        } catch {
          arr = [value];
        }
      }

      if (!Array.isArray(arr)) {
        return helpers.error("any.invalid");
      }

      for (const item of arr) {
        if (typeof item === "object" && item !== null) {
          return helpers.error("any.invalid");
        }
        if (!mongoose.Types.ObjectId.isValid(item)) {
          return helpers.error("any.invalid");
        }
      }

      return arr;
    })
    .messages({
      "any.invalid": "Invalid ID",
    })
    .optional()
    .default([]);

const businessStepSchema = {
  /* =========================
     STEP 1 – BUSINESS INFO
  ========================= */
  1: Joi.object({
    category_id: Joi.string().required().messages({
      "any.required": "Category is required",
      "string.empty": "Category is required",
    }),

    sub_category_id: Joi.string().allow("", null).optional(),

    business_name: Joi.string().min(5).max(60).required().messages({
      "any.required": "Business name is required",
      "string.empty": "Business name is required",
      "string.min": "Business name must be at least 5 characters",
      "string.max": "Business name must not exceed 60 characters",
    }),

    business_address: Joi.string().min(10).max(200).required().messages({
      "any.required": "Business address is required",
      "string.empty": "Business address is required",
      "string.min": "Business address must be at least 10 characters",
      "string.max": "Business address must not exceed 200 characters",
    }),

    ad_description: Joi.string().min(500).max(700).required().messages({
      "any.required": "Description is required",
      "string.empty": "Description is required",
      "string.min": "Description must be at least 500 characters",
      "string.max": "Description must not exceed 700 characters",
    }),

    establishment_year: Joi.number()
      .integer()
      .min(1800)
      .max(new Date().getFullYear())
      .allow(null)
      .optional()
      .messages({
        "number.min": "Establishment year must be 1800 or later",
        "number.max": `Establishment year cannot be in the future`,
        "number.integer": "Establishment year must be a valid year",
      }),

    uen_number: Joi.string().allow("", null).optional(),

    facilities: objectIdArray().messages({
      "any.invalid": "Invalid facility",
    }),
    services: objectIdArray().messages({
      "any.invalid": "Invalid service",
    }),
    courses: objectIdArray().messages({
      "any.invalid": "Invalid course",
    }),
    payments: objectIdArray().messages({
      "any.invalid": "Invalid payment",
    }),

    hours: Joi.alternatives()
      .try(Joi.object(), Joi.string())
      .allow(null)
      .optional(),

    additional_fields: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.object({
            field_id: Joi.string().required().messages({
              "any.required": "field_id is required in additional fields",
              "string.empty": "field_id must not be empty",
            }),
            value: Joi.any().allow(null).optional(),
          }),
        ),
        Joi.string(),
      )
      .optional()
      .default([]),

    seo_title: Joi.string().allow("", null).optional(),
    seo_description: Joi.string().allow("", null).optional(),
  }).options({ allowUnknown: true }),

  /* =========================
     STEP 2 – CONTACT & SOCIAL (COMBINED)
     Supports both combined and legacy social
  ========================= */
  2: Joi.object({
    // Contact fields
    name: Joi.string().min(2).max(50).allow("", null).optional(),
    email: Joi.string().allow("", null).optional(),
    country_code: Joi.string().allow("", null).optional(),
    mobile_number: Joi.string().allow("", null).optional(),
    alt_country_code: Joi.string().allow("", null).optional(),
    second_mobile_number: Joi.string().allow("", null).optional(),
    locality: Joi.string().allow("", null).optional(),
    city_id: Joi.string().allow("", null).optional(),

    // Social fields
    websiteLink: Joi.string().uri().allow("", null).optional(),
    videoLink: Joi.string().uri().allow("", null).optional(),
    facebook: Joi.string().uri().allow("", null).optional(),
    instagram: Joi.string().uri().allow("", null).optional(),
    twitter: Joi.string().uri().allow("", null).optional(),
    linkedin: Joi.string().uri().allow("", null).optional(),
    youtube: Joi.string().uri().allow("", null).optional(),
  }).options({ allowUnknown: true }),

  /* =========================
     STEP 3 – MEDIA (NEW STEP 3) OR LEGACY CONTACT
  ========================= */
  3: Joi.object({
    name: Joi.string().allow("", null).optional(),
    email: Joi.string().allow("", null).optional(),
    country_code: Joi.string().allow("", null).optional(),
    mobile_number: Joi.string().allow("", null).optional(),
    alt_country_code: Joi.string().allow("", null).optional(),
    second_mobile_number: Joi.string().allow("", null).optional(),
    locality: Joi.string().allow("", null).optional(),
    city_id: Joi.string().allow("", null).optional(),
  }).options({ allowUnknown: true }),

  /* =========================
     STEP 4 – PLAN (NEW STEP 4) OR LEGACY SEO
  ========================= */
  4: Joi.object({
    plan_id: Joi.string().allow("", null).optional(),
    seo_title: Joi.string().allow("", null).optional(),
    seo_description: Joi.string().allow("", null).optional(),
  }).options({ allowUnknown: true }),

  /* =========================
     STEP 5 – LEGACY MEDIA
  ========================= */
  5: Joi.object({}).options({ allowUnknown: true }),

  /* =========================
     STEP 6 – LEGACY PLAN
  ========================= */
  6: Joi.object({
    plan_id: Joi.string().allow("", null).optional(),
  }).options({ allowUnknown: true }),
};

export default businessStepSchema;
