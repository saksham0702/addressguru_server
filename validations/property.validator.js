// ─── validations/property.validator.js ────────────────────────────────────────
import Joi from "joi";

const propertyStepSchema = {
  /* =========================
     STEP 1 – PROPERTY INFO
  ========================= */
  1: Joi.object({
    category_id: Joi.string().required().messages({
      "any.required": "Category is required",
      "string.empty": "Category is required",
    }),

    sub_category_id: Joi.string().allow("", null).optional(),

    purpose: Joi.string().required().messages({
      "any.required": "Purpose is required",
      "string.empty": "Purpose is required",
    }),

    sold_by: Joi.string().required().messages({
      "any.required": "Sold by is required",
      "string.empty": "Sold by is required",
    }),

    cae_number: Joi.string().allow("", null).optional(),

    available_from: Joi.date().iso().required().messages({
      "any.required": "Available from date is required",
      "date.base": "Available from must be a valid date",
      "date.format": "Available from must be in ISO format",
    }),

    title: Joi.string().min(5).max(60).required().messages({
      "any.required": "Title is required",
      "string.empty": "Title is required",
      "string.min": "Title must be at least 5 characters",
      "string.max": "Title must not exceed 60 characters",
    }),

    description: Joi.string().min(200).max(1500).required().messages({
      "any.required": "Description is required",
      "string.empty": "Description is required",
      "string.min": "Description must be at least 200 characters",
      "string.max": "Description must not exceed 1500 characters",
    }),

    area_size: Joi.number().positive().required().messages({
      "any.required": "Area size is required",
      "number.base": "Area size must be a number",
      "number.positive": "Area size must be greater than 0",
    }),

    area_unit: Joi.string().default("sqft").optional(),
    currency: Joi.string().default("AED").optional(),
    price_currency: Joi.string().default("AED").optional(),
    price_amount: Joi.number().min(0).allow(null).optional(),
    price_period: Joi.string().allow("", null).optional(),
    price_negotiable: Joi.boolean().default(false).optional(),
    price_fixed: Joi.boolean().default(false).optional(),
    price_free: Joi.boolean().default(false).optional(),

    additional_fields: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.object({
            field_id: Joi.string().required(),
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
     STEP 2 – IMAGES
  ========================= */
  2: Joi.object({}).options({ allowUnknown: true }),

  /* =========================
     STEP 3 – CONTACT & SOCIAL
  ========================= */
  3: Joi.object({
    name: Joi.string().min(2).max(50).required().messages({
      "any.required": "Name is required",
      "string.empty": "Name is required",
      "string.min": "Name must be at least 2 characters",
      "string.max": "Name must not exceed 50 characters",
    }),

    email: Joi.string().email().allow("", null).optional().messages({
      "string.email": "Please provide a valid email address",
    }),

    country_code: Joi.string().allow("", null).optional(),
    mobile_number: Joi.string().required().messages({
      "any.required": "Mobile number is required",
      "string.empty": "Mobile number is required",
    }),
    alt_country_code: Joi.string().allow("", null).optional(),
    second_mobile_number: Joi.string().allow("", null).optional(),
    city_id: Joi.string().required().messages({
      "any.required": "City is required",
      "string.empty": "City is required",
    }),
    address: Joi.string().required().messages({
      "any.required": "Address is required",
      "string.empty": "Address is required",
    }),
    locality: Joi.string().allow("", null).optional(),
    map_lat: Joi.number().min(-90).max(90).allow(null).optional(),
    map_lng: Joi.number().min(-180).max(180).allow(null).optional(),

    // Social Links
    websiteLink: Joi.string().uri().allow("", null).optional(),
    videoLink: Joi.string().uri().allow("", null).optional(),
    facebook: Joi.string().uri().allow("", null).optional(),
    instagram: Joi.string().uri().allow("", null).optional(),
    twitter: Joi.string().uri().allow("", null).optional(),
    linkedin: Joi.string().uri().allow("", null).optional(),
    youtube: Joi.string().uri().allow("", null).optional(),
  }).options({ allowUnknown: true }),

  /* =========================
     STEP 4 – PLAN (NEW) OR LEGACY SEO
  ========================= */
  4: Joi.object({
    plan_id: Joi.string().allow("", null).optional(),
    seo_title: Joi.string().allow("", null).optional(),
    seo_description: Joi.string().allow("", null).optional(),
  }).options({ allowUnknown: true }),

  /* =========================
     STEP 5 – LEGACY PLAN
  ========================= */
  5: Joi.object({
    plan_id: Joi.string().allow("", null).optional(),
  }).options({ allowUnknown: true }),
};

export default propertyStepSchema;
