import Joi from "joi";

export const commonRules = {
  mongoId: Joi.string().hex().length(24),

  email: Joi.string()
    .email({ tlds: { allow: false } })
    .messages({
      "string.empty": "Email is required",
      "string.email": "Invalid email address",
    }),
    
  mobile: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .messages({
      "string.empty": "Mobile number is required",
      "string.pattern.base": "Invalid mobile number",
    }),

  name: Joi.string().min(2).messages({
    "string.empty": "Name is required",
    "string.min": "Name must be at least 2 characters",
  }),

  requiredString: (label) =>
    Joi.string()
      .required()
      .messages({
        "string.empty": `${label} is required`,
        "any.required": `${label} is required`,
      }),
};
