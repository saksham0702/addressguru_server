// validators/business.validator.js
import Joi from "joi";
import { commonRules } from "./common.validator.js";

// ─── reusable: accepts both real array and single string ──────────────────────
const stringArray = () =>
  Joi.alternatives()
    .try(
      Joi.array().items(Joi.string()),
      Joi.string(), // single value — middleware will convert to array
    )
    .default([]);

export const businessStepSchemas = {
  /* =========================
     STEP 1 – BUSINESS INFO
  ========================== */
  1: Joi.object({
    step: Joi.number().valid(1).required(),

    category_id: commonRules.mongoId.required().messages({
      "any.required": "Category is required",
      "string.empty": "Category is required",
    }),

    sub_category_id: commonRules.mongoId.optional().allow("", null),

    business_name: commonRules.requiredString("Business name"),
    business_address: commonRules.requiredString("Business address"),

ad_description: Joi.string()
  .min(200)
  .max(700)
  .optional()
  .allow("", null)
  .messages({
    "string.min": "Ad description must be at least 200 characters long",
    "string.max": "Ad description must not exceed 700 characters",
    "string.base": "Ad description must be a string"
  }),
    establishment_year: Joi.number()
      .integer()
      .min(1800)
      .max(new Date().getFullYear())
      .optional()
      .allow("", null),
    uen_number: Joi.string().optional().allow("", null),

    facilities: stringArray(),
    services: stringArray(),
    courses: stringArray(),
    payments: stringArray(),

    hours: Joi.alternatives()
      .try(Joi.object(), Joi.string())
      .optional()
      .allow("", null),

    additional_fields: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.object({
            field_id: commonRules.mongoId.required(),
            value: Joi.alternatives()
              .try(Joi.string(), Joi.number(), Joi.array().items(Joi.string()))
              .allow(null)
              .optional(),
          }),
        ),
        Joi.string(), // parsed in middleware before Joi runs
      )
      .default([]),
  }),

  /* =========================
     STEP 2 – SOCIAL LINKS
  ========================== */
  2: Joi.object({
    step: Joi.number().valid(2).required(),

    listing_id: commonRules.mongoId
      .required()
      .messages({ "any.required": "Listing ID is required" }),

    website_link: Joi.string()
      .uri()
      .optional()
      .allow("", null)
      .messages({ "string.uri": "Invalid website URL" }),
    video_link: Joi.string()
      .uri()
      .optional()
      .allow("", null)
      .messages({ "string.uri": "Invalid video URL" }),

    facebook: Joi.string().uri().optional().allow("", null),
    instagram: Joi.string().uri().optional().allow("", null),
    twitter: Joi.string().uri().optional().allow("", null),
    linkedin: Joi.string().uri().optional().allow("", null),
    youtube: Joi.string().uri().optional().allow("", null),
  }),

  /* =========================
     STEP 3 – CONTACT DETAILS
  ========================== */
  3: Joi.object({
    step: Joi.number().valid(3).required(),

    listing_id: commonRules.mongoId.required(),

    name: commonRules.name.required(),
    email: commonRules.email.required(),
    country_code: Joi.number().optional().allow("", null),
    mobile_number: commonRules.mobile.required(),
    alt_country_code: Joi.number().optional().allow("", null),
    second_mobile_number: commonRules.mobile.optional().allow("", null),
    locality: commonRules.requiredString("Locality"),
    city: Joi.string().optional().allow("", null),
  }),

  /* =========================
     STEP 4 – SEO
  ========================== */
  4: Joi.object({
    step: Joi.number().valid(4).required(),

    listing_id: commonRules.mongoId.required(),
    seo_title: commonRules.requiredString("SEO title"),
    seo_description: commonRules.requiredString("SEO description"),
  }),

  // Step 5 — multer handles files, no Joi schema needed

  /* =========================
     STEP 6 – PLAN & PUBLISH
  ========================== */
  6: Joi.object({
    step: Joi.number().valid(6).required(),

    listing_id: commonRules.mongoId.required(),
    plan_id: commonRules.mongoId
      .required()
      .messages({ "any.required": "Plan is required" }),
  }),
};
