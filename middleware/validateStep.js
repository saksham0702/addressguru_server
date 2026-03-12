export const validateStep = (schemaMap) => {
  return (req, res, next) => {
    const step = Number(req.params.step ?? req.body?.step);

    if (!schemaMap[step]) {
      return next();
    }

    if (!step || isNaN(step)) {
      return res.status(400).json({ success: false, message: "Invalid step" });
    }

    // Inject normalized step into body
    req.body = { ...req.body, step };

    // ── Parse JSON string fields sent via form-data ──────────────────────────
    const jsonFields = [
      "hours",
      "additional_fields",
      // business fields
      "facilities",
      "services",
      "courses",
      "payments",
      // job fields
      "requirements",
      "responsibilities",
      "benefits",
      "salary",
      "location",
      "experienceYears",
      "ageRange",
      "contact",
      "company",
      "seo_keywords",
    ];
    for (const field of jsonFields) {
      if (typeof req.body[field] === "string") {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch {
          // Leave as-is; Joi will reject if truly invalid
        }
      }
    }

    // ── Step 2: normalize single string to array for array fields ────────────
    const arrayFields = [
      "facilities",
      "services",
      "courses",
      "payments",
      "requirements",
      "responsibilities",
      "benefits",
      "seo_keywords",
    ];
    for (const field of arrayFields) {
      if (typeof req.body[field] === "string") {
        req.body[field] = [req.body[field]];
      }
    }

    // ── If no schema defined for this step (e.g. file-only steps), skip validation
    if (!schemaMap[step]) {
      return next();
    }

    // ── Validate ──────────────────────────────────────────────────────────────
    const { error, value } = schemaMap[step].validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = {};
      error.details.forEach((err) => {
        const key = err.path[0];
        errors[key] = err.message;
      });
      return res.status(400).json({ success: false, errors });
    }

    req.body = value;
    next();
  };
};
