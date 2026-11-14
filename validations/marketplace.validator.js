import Joi from "joi";

const marketplaceStepSchema = {
  /* =========================
     STEP 1 – BASIC INFO
  ========================= */
  1: Joi.object({
    category_id: Joi.string().required().messages({
      "any.required": "Category is required",
      "string.empty": "Category is required",
    }),

    sub_category_id: Joi.string().allow("", null).optional(),

    title: Joi.string().min(5).max(60).required().messages({
      "any.required": "Title is required",
      "string.empty": "Title is required",
      "string.min": "Title must be at least 5 characters",
      "string.max": "Title must not exceed 60 characters",
    }),

    description: Joi.string().min(200).max(700).required().messages({
      "any.required": "Description is required",
      "string.empty": "Description is required",
      "string.min": "Description must be at least 200 characters",
      "string.max": "Description must not exceed 700 characters",
    }),

    condition: Joi.string().required().messages({
      "any.required": "Condition is required",
      "string.empty": "Condition is required",
    }),

    price_amount: Joi.number().min(0).allow(null).optional(),
    price_currency: Joi.string().default("AED").optional(),
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
     Multer handles files
  ========================= */
  2: Joi.object({}).options({ allowUnknown: true }),

  /* =========================
     STEP 3 – CONTACT & SOCIAL
  ========================= */
  3: Joi.object({
    name: Joi.string().min(2).max(50).required().messages({
      "any.required": "Name is required",
      "string.empty": "Name is required",
    }),

    email: Joi.string().email().required().messages({
      "any.required": "Email is required",
      "string.empty": "Email is required",
      "string.email": "Please provide a valid email address",
    }),

    country_code: Joi.string().allow("", null).optional(),
    mobile_number: Joi.string().required().messages({
      "any.required": "Mobile number is required",
      "string.empty": "Mobile number is required",
    }),
    alt_country_code: Joi.string().allow("", null).optional(),
    second_mobile_number: Joi.string().allow("", null).optional(),
    locality: Joi.string().required().messages({
      "any.required": "Locality is required",
      "string.empty": "Locality is required",
    }),
    address: Joi.string().allow("", null).optional(),
    city_id: Joi.string().required().messages({
      "any.required": "City is required",
      "string.empty": "City is required",
    }),

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

export default marketplaceStepSchema;
