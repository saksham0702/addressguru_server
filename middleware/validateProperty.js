// ─── middleware/validateProperty.js ──────────────────────────────────────────
import propertyStepSchema from "../validations/property.validator.js";

export const validatePropertyStep = (req, res, next) => {
  try {
    const step = Number(req.params.step);
    const schema = propertyStepSchema[step];

    if (!schema) {
      return res.status(400).json({
        success: false,
        message: "Invalid step",
      });
    }

    // Step 2 is images only — multer hasn't run yet at this point
    // so body will be empty; skip deep validation and just pass through
    if (step === 2) return next();

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true, // remove extra fields not in schema
      convert: true, // auto-convert "true"/"false" strings from formdata to booleans
    });

    if (error) {
      // Build key-value error object: { fieldName: "error message" }
      const errors = {};
      error.details.forEach((e) => {
        const key =
          e.path.length > 0 ? e.path.join(".") : e.context?.key || "unknown";
        errors[key] = e.message;
      });

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // Replace req.body with sanitized + defaulted value from Joi
    req.body = value;

    next();
  } catch (err) {
    console.error("Property validation middleware error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal validation error",
    });
  }
};
