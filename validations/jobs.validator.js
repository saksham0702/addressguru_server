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

    slug: Joi.string().optional().messages({
      "string.empty": "Slug cannot be empty",
    }),

    category_id: commonRules.mongoId.required().messages({
      "any.required": "Job category is required",
      "string.empty": "Job category is required",
      "string.pattern.base": "Invalid job category",
    }),
    sub_category_id: commonRules.mongoId.optional().allow("", null),

    title: Joi.string().trim().min(5).max(60).required().messages({
      "any.required": "Job title is required",
      "string.empty": "Job title is required",
      "string.min": "Job title must be at least 5 characters",
      "string.max": "Job title must not exceed 60 characters",
    }),
    description: Joi.string().trim().min(200).max(500).required().messages({
      "any.required": "Job description is required",
      "string.empty": "Job description is required",
      "string.min": "Job description must be at least 200 characters",
      "string.max": "Job description must not exceed 500 characters",
    }),

    requirements: stringArray(),
    responsibilities: stringArray(),
    benefits: stringArray(),
    skills: stringArray(),

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
        "other",
      )
      .required()
      .messages({
        "any.required": "Sector is required",
        "string.empty": "Sector is required",
        "any.only": "Invalid sector",
      }),

    jobType: Joi.string()
      .valid(
        "full-time",
        "part-time",
        "contract",
        "freelance",
        "internship",
        "temporary",
      )
      .required()
      .messages({
        "any.required": "Job type is required",
        "string.empty": "Job type is required",
        "any.only": "Invalid job type",
      }),

    workMode: Joi.string()
      .valid("on-site", "remote", "hybrid")
      .optional()
      .default("on-site")
      .messages({ "any.only": "Invalid work mode" }),

    experienceLevel: Joi.string()
      .valid("entry", "junior", "mid", "senior", "lead", "executive")
      .required()
      .messages({
        "any.required": "Experience level is required",
        "string.empty": "Experience level is required",
        "any.only": "Invalid experience level",
      }),

    total_positions: Joi.number().integer().min(1).optional().default(1),

    // Salary (JSON object parsed by middleware)
    salary: Joi.object({
      from: Joi.number().optional().allow(null, ""),
      to: Joi.number().optional().allow(null, ""),
      currency: Joi.string().optional().default("AED"),
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
      country: Joi.string().optional().default("UAE"),

      city: Joi.object({
        _id: Joi.string().required(),
        name: Joi.string().required(),
        slug: Joi.string().required(),
      })
        .optional()
        .allow(null),

      area: Joi.string().optional().allow("", null),
      address: Joi.string().optional().allow("", null),
      isRemote: Joi.boolean().optional().default(false),
    }),

    education: Joi.string()
      .valid(
        "none",
        "matric",
        "intermediate",
        "bachelor",
        "master",
        "phd",
        "any",
      )
      .optional()
      .default("any"),

    noOfExperience: Joi.string().optional().allow("", null),

    gender: Joi.string()
      .valid("male", "female", "any")
      .optional()
      .default("any"),

    // Age Range (JSON object parsed by middleware)
    ageRange: Joi.object({
      from: Joi.number().min(0).max(100).optional().allow(null, ""),
      to: Joi.number().min(0).max(100).optional().allow(null, ""),
    })
      .optional()
      .allow(null, ""),

    nationality: stringArray(),
    language: stringArray(),
  }),

  /* =========================
     STEP 2 – CONTACT, MEDIA & SEO
  ========================== */
  2: Joi.object({
    step: Joi.number().valid(2).required(),

    // job_id: commonRules.mongoId
    //   .required()
    //   .messages({ "any.required": "Job ID is required" }),

    slug: Joi.string().optional().messages({
      "string.empty": "Slug cannot be empty",
    }),

    previous_company_logo: Joi.string().optional().allow("", null),

    job_id: commonRules.mongoId
      .optional()
      .messages({ "string.pattern.base": "Invalid Job ID" }),

    // Contact Info (JSON object parsed by middleware)
    contact: Joi.object({
      name: Joi.string().trim().min(2).max(50).optional().allow("", null).messages({
        "string.min": "Contact name must be at least 2 characters",
        "string.max": "Contact name must not exceed 50 characters",
      }),
      email: Joi.string().email().optional().allow("", null).messages({
        "string.email": "Please provide a valid email address",
      }),
      countryCode: Joi.string().optional().allow("", null),
      phone: Joi.string().optional().allow("", null),
      whatsapp: Joi.string().optional().allow("", null),
      website: Joi.string().uri().optional().allow("", null).messages({
        "string.uri": "Please enter a valid contact website URL (including https://)",
      }),
      applyEmail: Joi.string().email().optional().allow("", null).messages({
        "string.email": "Please provide a valid apply email address",
      }),
    })
      .optional()
      .allow(null, ""),

    // Company Info (JSON object parsed by middleware)
    company: Joi.object({
      name: Joi.string().trim().min(2).max(100).optional().allow("", null).messages({
        "string.min": "Company name must be at least 2 characters",
        "string.max": "Company name must not exceed 100 characters",
      }),
      website: Joi.string().uri().optional().allow("", null).messages({
        "string.uri": "Please enter a valid company website URL (including https://)",
      }),
      description: Joi.string().trim().min(200).max(500).optional().allow("", null).messages({
        "string.min": "Company description must be at least 200 characters",
        "string.max": "Company description must not exceed 500 characters",
      }),
      size: Joi.string()
        .valid("1-10", "11-50", "51-200", "201-500", "500+")
        .optional()
        .allow("", null),
      address: Joi.string().trim().max(300).optional().allow("", null),
      locality: Joi.string().trim().optional().allow("", null),
      city: Joi.object({
        _id: Joi.string().required(),
        name: Joi.string().required(),
        slug: Joi.string().required(),
      })
        .optional()
        .allow(null),
      // logo is uploaded and handled by multer, not validated by Joi
    })
      .optional()
      .allow(null, ""),

    seo_title: Joi.string().trim().max(120).optional().allow("", null).messages({
      "string.max": "Meta title must not exceed 120 characters",
    }),
    seo_description: Joi.string().trim().max(300).optional().allow("", null).messages({
      "string.max": "Meta description must not exceed 300 characters",
    }),
    seo_keywords: stringArray(),

    application_deadline: Joi.date().iso().optional().allow("", null),
    logo_url: Joi.string().optional().allow("", null),
  }).options({ allowUnknown: true }),
};
