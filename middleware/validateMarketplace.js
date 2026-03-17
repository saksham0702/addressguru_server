import { marketplaceStepSchemas } from "../validations/marketplace.validator.js";

export const validateMarketplaceStep = (req, res, next) => {
  try {
    const step = Number(req.params.step);
    const schema = marketplaceStepSchemas[step];

    console.log("step", step);
    console.log("body", req.body);
    console.log("params", req.params);

    if (!schema) {
      return res.status(400).json({
        success: false,
        message: "Invalid step",
      });
    }

    const { error } = schema.validate(req.body, {
      abortEarly: false,
    });

    console.log("error", error);

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((e) => e.message),
      });
    }

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Validation error",
    });
  }
};
