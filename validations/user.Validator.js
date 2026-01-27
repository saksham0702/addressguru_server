// validators/userValidator.js
import Joi from "joi";
import { ROLES } from "../services/constant.js";

/**
 * Build a set of allowed role values from ROLES constant.
 * ROLES may use numbers or strings; we accept both forms in validation.
 */
const roleValues = Object.values(ROLES || {}).map((r) =>
  typeof r === "number" ? r : String(r)
);
const roleStringValues = Object.values(ROLES || {}).map((r) => String(r));
const allowedRoleAlternatives = Array.from(
  new Set([...roleValues, ...roleStringValues])
);

/**
 * Joi validation schema matching the User mongoose schema fields that are
 * relevant for registration.
 */
export const validateUser = Joi.object({
  name: Joi.string().trim().min(1).optional().messages({
    "string.empty": "Name must not be empty",
  }),

  email: Joi.string().email().lowercase().required().messages({
    "string.empty": "Email is required.",
    "string.email": "Please enter a valid email address.",
  }),

  phone: Joi.string()
    .trim()
    .optional()
    .allow(null, "")
    .pattern(/^[0-9+()\-\s]{6,20}$/)
    .messages({
      "string.pattern.base": "Phone number format is invalid.",
    }),

  whatsapp_same: Joi.boolean().optional(),

  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required.",
    "string.min": "Password must be at least 6 characters long.",
  }),

  avatar: Joi.string().uri().optional().allow(null, ""),

  role: Joi.alternatives()
    .try(
      Joi.string().valid(...allowedRoleAlternatives),
      Joi.number().valid(
        ...allowedRoleAlternatives.filter((v) => typeof v === "number")
      )
    )
    .optional()
    .messages({
      "any.only": `Role must be one of: ${allowedRoleAlternatives.join(", ")}`,
    }),

  login_type: Joi.string().valid("google", "apple", "email").optional(),
  provider: Joi.string().valid("google", "apple").optional(),
  providerId: Joi.string().optional().allow(null, ""),

  // Profile fields
  profile_bio: Joi.string().max(500).optional().allow(null, ""),
  profile_website: Joi.string().uri().optional().allow(null, ""),
  profile_location_emirate: Joi.string().optional().allow(null, ""),
  profile_location_area: Joi.string().optional().allow(null, ""),

  // membership
  membership_type: Joi.string().valid("free", "premium", "featured").optional(),
  membership_expiresAt: Joi.date().optional(),

  // preferences (optional)
  preferences_notifications_email: Joi.boolean().optional(),
  preferences_notifications_sms: Joi.boolean().optional(),
  preferences_notifications_push: Joi.boolean().optional(),
  preferences_language: Joi.string().optional(),

  // status
  status: Joi.boolean().optional(),

  // Any extra fields must be explicitly allowed if you want to accept them
}).options({ stripUnknown: true }); // strip unknown fields by default
