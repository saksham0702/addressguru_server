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

    title: Joi.string().min(5).max(100).required().messages({
      "any.required": "Title is required",
      "string.empty": "Title is required",
      "string.min": "Title must be at least 5 characters",
      "string.max": "Title must not exceed 100 characters",
    }),

    description: Joi.string().min(500).max(700).required().messages({
      "any.required": "Description is required",
      "string.empty": "Description is required",
      "string.min": "Description must be at least 500 characters",
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

    // Client sends only field_id + value
    // field_label and field_type are resolved server-side from DB
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
     STEP 2 – IMAGES
     Multer handles files,
     no body fields expected
  ========================= */
  2: Joi.object({}).options({ allowUnknown: true }), // allow multer-parsed fields silently

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

    country_code: Joi.string().allow("", null).optional(),

    // String to preserve leading zeros and international format
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

    address: Joi.string().required().messages({
      "any.required": "Address is required",
      "string.empty": "Address is required",
    }),

    city_id: Joi.string().required().messages({
      "any.required": "City is required",
      "string.empty": "City is required",
    }),
  }).options({ allowUnknown: false }),

  /* =========================
     STEP 4 – SEO
  ========================= */
  4: Joi.object({
    seo_title: Joi.string().min(3).max(100).required().messages({
      "any.required": "SEO title is required",
      "string.empty": "SEO title is required",
      "string.min": "SEO title must be at least 3 characters",
      "string.max": "SEO title must not exceed 100 characters",
    }),

    seo_description: Joi.string().min(10).max(300).required().messages({
      "any.required": "SEO description is required",
      "string.empty": "SEO description is required",
      "string.min": "SEO description must be at least 10 characters",
      "string.max": "SEO description must not exceed 300 characters",
    }),
  }).options({ allowUnknown: false }),

  /* =========================
     STEP 5 – PLAN & PUBLISH
  ========================= */
  5: Joi.object({
    plan_id: Joi.string().required().messages({
      "any.required": "Plan is required",
      "string.empty": "Plan is required",
    }),
  }).options({ allowUnknown: false }),
};
export default marketplaceStepSchema;
