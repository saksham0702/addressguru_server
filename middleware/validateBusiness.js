// ─── middleware/validateBusiness.js ───────────────────────────────────────────
import businessStepSchema from "../validations/business.validator.js";
export const validateBusinessStep = (req, res, next) => {
  try {
    const step = Number(req.params.step);
    const schema = businessStepSchema[step];

    if (!schema) {
      return res.status(400).json({
        success: false,
        message: "Invalid step",
      });
    }

    // Step 5 is media only — multer hasn't run yet at this point
    // logo and images are handled by multer, skip body validation
    if (step === 5) return next();

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true, // remove extra fields not in schema
      convert: true,      // auto-convert "true"/"false" strings → booleans, "123" → numbers
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
    console.error("Business validation middleware error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal validation error",
    });
  }
};