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

export const jobStepSchemas = {
  /* =========================
     STEP 1 – JOB DETAILS & REQUIREMENTS
  ========================== */
  1: Joi.object({
    step: Joi.number().valid(1).required(),

    slug: Joi.string()
      .optional()
      .messages({
        "string.empty": "Slug cannot be empty",
      }),


    category_id: commonRules.mongoId.optional().allow("", null),
    sub_category_id: commonRules.mongoId.optional().allow("", null),

    title: Joi.string().optional().allow("", null),
    description: Joi.string().optional().allow("", null),

    requirements: stringArray(),
    responsibilities: stringArray(),
    benefits: stringArray(),

    sector: Joi.string()
      .valid(
        "it",
        "commerce",
        "finance",
        "healthcare",
        "education",
        "engineering",
        "marketing",
        "legal",
        "hospitality",
        "construction",
        "media",
        "ngo",
        "government",
        "other"
      )
      .optional()
      .messages({ "any.only": "Invalid sector" }),

    jobType: Joi.string()
      .valid(
        "full-time",
        "part-time",
        "contract",
        "freelance",
        "internship",
        "temporary"
      )
      .optional()
      .messages({ "any.only": "Invalid job type" }),

    workMode: Joi.string()
      .valid("on-site", "remote", "hybrid")
      .optional()
      .default("on-site")
      .messages({ "any.only": "Invalid work mode" }),

    experienceLevel: Joi.string()
      .valid("entry", "junior", "mid", "senior", "lead", "executive")
      .optional()
      .messages({ "any.only": "Invalid experience level" }),

    total_positions: Joi.number().integer().min(1).optional().default(1),

    // Salary (JSON object parsed by middleware)
    salary: Joi.object({
      from: Joi.number().optional().allow(null, ""),
      to: Joi.number().optional().allow(null, ""),
      currency: Joi.string().optional().default("PKR"),
      period: Joi.string()
        .valid("monthly", "yearly", "weekly", "daily", "hourly")
        .optional()
        .default("monthly"),
      isNegotiable: Joi.boolean().optional().default(false),
      isHidden: Joi.boolean().optional().default(false),
    })
      .optional()
      .allow(null, ""),

    // Location (JSON object parsed by middleware)
    location: Joi.object({
      country: Joi.string().optional().default("Pakistan"),
      city: Joi.string().optional().allow("", null),
      area: Joi.string().optional().allow("", null),
      address: Joi.string().optional().allow("", null),
      isRemote: Joi.boolean().optional().default(false),
    })
      .optional()
      .allow(null, ""),

    education: Joi.string()
      .valid("none", "matric", "intermediate", "bachelor", "master", "phd", "any")
      .optional()
      .default("any"),

    // Experience Years (JSON object parsed by middleware)
    experienceYears: Joi.object({
      from: Joi.number().min(0).optional().default(0),
      to: Joi.number().min(0).optional().allow(null, ""),
    })
      .optional()
      .allow(null, ""),

    gender: Joi.string().valid("male", "female", "any").optional().default("any"),

    // Age Range (JSON object parsed by middleware)
    ageRange: Joi.object({
      from: Joi.number().min(18).max(100).optional().allow(null, ""),
      to: Joi.number().min(18).max(100).optional().allow(null, ""),
    })
      .optional()
      .allow(null, ""),
  }),

  /* =========================
     STEP 2 – CONTACT, MEDIA & SEO
  ========================== */
  2: Joi.object({
    step: Joi.number().valid(2).required(),

    // job_id: commonRules.mongoId
    //   .required()
    //   .messages({ "any.required": "Job ID is required" }),

    slug: Joi.string()
      .optional()
      .messages({
        "string.empty": "Slug cannot be empty",
      }),

    job_id: commonRules.mongoId
      .optional()
      .messages({ "string.pattern.base": "Invalid Job ID" }),

    // Contact Info (JSON object parsed by middleware)
    contact: Joi.object({
      name: Joi.string().optional().allow("", null),
      email: Joi.string().email().optional().allow("", null),
      phone: Joi.string().optional().allow("", null),
      whatsapp: Joi.string().optional().allow("", null),
      website: Joi.string().uri().optional().allow("", null),
      applyEmail: Joi.string().email().optional().allow("", null),
    })
      .optional()
      .allow(null, ""),

    // Company Info (JSON object parsed by middleware)
    company: Joi.object({
      name: Joi.string().optional().allow("", null),
      website: Joi.string().uri().optional().allow("", null),
      size: Joi.string()
        .valid("1-10", "11-50", "51-200", "201-500", "500+")
        .optional()
        .allow("", null),
      // logo is uploaded and handled by multer, not validated by Joi
    })
      .optional()
      .allow(null, ""),

    seo_title: Joi.string().optional().allow("", null),
    seo_description: Joi.string().optional().allow("", null),
    seo_keywords: stringArray(),

    application_deadline: Joi.date().iso().optional().allow("", null),
  }),
};
