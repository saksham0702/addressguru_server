import marketplaceStepSchema from "../validations/marketplace.validator.js";

export const validateMarketplaceStep = (req, res, next) => {
  try {
    const step = Number(req.params.step);
    const schema = marketplaceStepSchema[step];

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
      stripUnknown: true, // remove any extra fields not in schema
      convert: true, // auto-convert strings to booleans/numbers where needed
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

    // Replace req.body with the sanitized + defaulted value from Joi
    req.body = value;

    next();
  } catch (err) {
    console.error("Validation middleware error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal validation error",
    });
  }
};
