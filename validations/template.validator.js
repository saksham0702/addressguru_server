import Joi from "joi";
import mongoose from "mongoose";

// Helper for ObjectId validation
const objectIdValidation = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
};

export const addTemplateSchema = Joi.object({
  title: Joi.string().trim().required().messages({
    "string.empty": "Template title is required",
    "any.required": "Template title is required",
  }),
  message: Joi.string().trim().required().messages({
    "string.empty": "Template message is required",
    "any.required": "Template message is required",
  }),
  type: Joi.string()
    .valid("whatsapp", "sms", "email")
    .required()
    .messages({
      "any.only": "Type must be one of: whatsapp, sms, email",
      "any.required": "Template type is required",
    }),
  subject: Joi.string().trim().optional(),
  status: Joi.string().valid("active", "inactive").optional(),
});

export const updateTemplateSchema = Joi.object({
  title: Joi.string().trim().optional(),
  message: Joi.string().trim().optional(),
  type: Joi.string().valid("whatsapp", "sms", "email").optional(),
  subject: Joi.string().trim().optional(),
  status: Joi.string().valid("active", "inactive").optional(),
}).min(1);

export const templateIdSchema = Joi.object({
  id: Joi.string().custom(objectIdValidation, "Object Id Validation").required().messages({
    "any.invalid": "Invalid Template ID format",
    "any.required": "Template ID is required",
  }),
});
