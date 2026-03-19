// ─── validations/business.validator.js ───────────────────────────────────────
import Joi from "joi";

// ─── reusable: accepts both real array and JSON stringified array ─────────────
const objectIdArray = () =>
  Joi.alternatives()
    .try(
      Joi.array().items(Joi.string()),
      Joi.string(), // single value or JSON stringified array from formdata
    )
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

    business_name: Joi.string().min(5).max(100).required().messages({
      "any.required": "Business name is required",
      "string.empty": "Business name is required",
      "string.min": "Business name must be at least 5 characters",
      "string.max": "Business name must not exceed 100 characters",
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

    // CategoryFeature-linked arrays — ObjectIds as strings
    facilities: objectIdArray(),
    services: objectIdArray(),
    courses: objectIdArray(),
    payments: objectIdArray(),

    // Working hours — object or JSON stringified object from formdata
    hours: Joi.alternatives()
      .try(Joi.object(), Joi.string())
      .allow(null)
      .optional(),

    // Client sends only field_id + value
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
        Joi.string(), // allow JSON stringified array from formdata
      )
      .optional()
      .default([]),
  }).options({ allowUnknown: false }),

  /* =========================
     STEP 2 – SOCIAL LINKS
     All fields optional —
     business may not have all
  ========================= */
  2: Joi.object({
    website_link: Joi.string().uri().allow("", null).optional().messages({
      "string.uri": "Website must be a valid URL (e.g. https://example.com)",
    }),

    video_link: Joi.string().uri().allow("", null).optional().messages({
      "string.uri": "Video link must be a valid URL",
    }),

    facebook: Joi.string().uri().allow("", null).optional().messages({
      "string.uri": "Facebook must be a valid URL",
    }),

    instagram: Joi.string().uri().allow("", null).optional().messages({
      "string.uri": "Instagram must be a valid URL",
    }),

    twitter: Joi.string().uri().allow("", null).optional().messages({
      "string.uri": "Twitter must be a valid URL",
    }),

    linkedin: Joi.string().uri().allow("", null).optional().messages({
      "string.uri": "LinkedIn must be a valid URL",
    }),

    youtube: Joi.string().uri().allow("", null).optional().messages({
      "string.uri": "YouTube must be a valid URL",
    }),
  }).options({ allowUnknown: false }),

  /* =========================
     STEP 3 – CONTACT DETAILS
  ========================= */
  3: Joi.object({
    name: Joi.string().min(2).max(50).required().messages({
      "any.required": "Name is required",
      "string.empty": "Name is required",
      "string.min": "Name must be at least 2 characters",
      "string.max": "Name must not exceed 50 characters",
    }),

    email: Joi.string().email().required().messages({
      "any.required": "Email is required",
      "string.empty": "Email is required",
      "string.email": "Please provide a valid email address",
    }),

    // String — preserves +971 format and leading zeros
    country_code: Joi.string().allow("", null).optional(),

    mobile_number: Joi.string().required().messages({
      "any.required": "Mobile number is required",
      "string.empty": "Mobile number is required",
    }),

    alt_country_code: Joi.string().allow("", null).optional(),

    second_mobile_number: Joi.string().allow("", null).optional(),

    locality: Joi.string().allow("", null).optional(),

    city_id: Joi.string()
      .pattern(/^[a-fA-F0-9]{24}$/)
      .required()
      .messages({
        "any.required": "City is required",
        "string.empty": "City is required",
        "string.pattern.base": "City must be a valid ID",
      }),
  }).options({ allowUnknown: false }),

  /* =========================
     STEP 4 – SEO
  ========================= */
  4: Joi.object({
    seo_title: Joi.string().min(5).max(100).required().messages({
      "any.required": "SEO title is required",
      "string.empty": "SEO title is required",
      "string.min": "SEO title must be at least 5 characters",
      "string.max": "SEO title must not exceed 100 characters",
    }),

    seo_description: Joi.string().min(50).max(300).required().messages({
      "any.required": "SEO description is required",
      "string.empty": "SEO description is required",
      "string.min": "SEO description must be at least 50 characters",
      "string.max": "SEO description must not exceed 300 characters",
    }),
  }).options({ allowUnknown: false }),

  /* =========================
     STEP 5 – MEDIA
     Multer handles logo + images,
     no body fields expected
  ========================= */
  5: Joi.object({}).options({ allowUnknown: true }),

  /* =========================
     STEP 6 – PLAN & PUBLISH
  ========================= */
  6: Joi.object({
    plan_id: Joi.string().required().messages({
      "any.required": "Plan is required",
      "string.empty": "Plan is required",
    }),
  }).options({ allowUnknown: false }),
};

export default businessStepSchema;
