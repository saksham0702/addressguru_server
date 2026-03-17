import Joi from "joi";

/* =========================
   STEP 1 – BASIC INFO
========================= */
export const marketplaceStepSchemas = {
  1: Joi.object({
    category_id: Joi.string().required().messages({
      "any.required": "Category is required",
      "string.empty": "Category is required",
    }),

    sub_category_id: Joi.string().allow("", null),

    title: Joi.string().min(3).max(100).required().messages({
      "string.empty": "Title is required",
      "string.min": "Title must be at least 3 characters",
      "string.max": "Title must not exceed 100 characters",
    }),

    description: Joi.string().min(10).max(2000).required().messages({
      "string.empty": "Description is required",
      "string.min": "Description must be at least 10 characters",
    }),

    condition: Joi.string().required().messages({
      "any.required": "Condition is required",
    }),

    price_amount: Joi.number().allow(null),

    price_currency: Joi.string().default("AED"),

    price_negotiable: Joi.boolean().default(false),
    price_fixed: Joi.boolean().default(false),
    price_free: Joi.boolean().default(false),

    additional_fields: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.object({
            field_id: Joi.string().required(),
            field_label: Joi.string().required(),
            field_type: Joi.string().required(),
            value: Joi.any().allow(null),
          }),
        ),
        Joi.string(),
      )
      .optional()
      .default([]),
  }),

  /* =========================
     STEP 2 – IMAGES
  ========================== */
  2: Joi.object({
    // multer handles files
  }),

  /* =========================
     STEP 3 – CONTACT DETAILS
  ========================== */
  3: Joi.object({
    name: Joi.string().min(2).max(50).required().messages({
      "string.empty": "Name is required",
    }),

    email: Joi.string().email().required().messages({
      "string.email": "Invalid email",
      "string.empty": "Email is required",
    }),

    country_code: Joi.string().allow("", null),

    mobile_number: Joi.number().required().messages({
      "any.required": "Mobile number is required",
    }),

    alt_country_code: Joi.string().allow("", null),

    second_mobile_number: Joi.number().allow(null),

    locality: Joi.string().required().messages({
      "string.empty": "Locality is required",
    }),

    address: Joi.string().required().messages({
      "string.empty": "Address is required",
    }),

    city_id: Joi.string().required().messages({
      "string.empty": "City is required",
    }),
  }),

  /* =========================
     STEP 4 – SEO
  ========================== */
  4: Joi.object({
    seo_title: Joi.string().min(3).max(100).required().messages({
      "string.empty": "SEO title is required",
    }),

    seo_description: Joi.string().min(10).max(300).required().messages({
      "string.empty": "SEO description is required",
    }),
  }),

  /* =========================
     STEP 5 – PLAN
  ========================== */
  6: Joi.object({
    plan_id: Joi.string().required().messages({
      "any.required": "Plan is required",
    }),
  }),
};
