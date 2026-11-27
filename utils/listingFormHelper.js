import slugify from "slugify";
import User from "../model/userSchema.js";
import { ROLES, ROLE_NAMES } from "../services/constant.js";

export const FORM_STEP_LABELS = {
  business: {
    1: "Business Information",
    2: "Contact & Social Details",
    3: "Media & Images",
    4: "Plan & Publish",
    5: "Media & Images",
    6: "Plan & Publish",
  },
  marketplace: {
    1: "Product Details",
    2: "Media & Images",
    3: "Contact & Social Details",
    4: "Plan & SEO",
    5: "Plan & Publish",
  },
  property: {
    1: "Property Details",
    2: "Media & Images",
    3: "Contact & Social Details",
    4: "Plan & Publish",
    5: "Plan & Publish",
  },
  jobs: {
    1: "Job Details",
    2: "Company, Contact & SEO",
    3: "Plan & Publish",
  },
};

export const escapeRegex = (str = "") =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const buildCaseInsensitiveExactRegex = (value = "") => {
  const cleaned = String(value ?? "").trim();
  return new RegExp(`^${escapeRegex(cleaned)}$`, "i");
};

export const resolveActorMeta = async (reqUser) => {
  const userId = reqUser?.id || reqUser?._id || null;
  let dbUser = null;
  if (userId) {
    try {
      dbUser = await User.findById(userId)
        .select("name roles role")
        .lean();
    } catch {
      dbUser = null;
    }
  }

  const rawRoles = Array.isArray(dbUser?.roles) && dbUser.roles.length > 0
    ? dbUser.roles
    : dbUser?.role
      ? [dbUser.role]
      : Array.isArray(reqUser?.roles) && reqUser.roles.length > 0
        ? reqUser.roles
        : reqUser?.role
          ? [reqUser.role]
          : [ROLES.USER];

  const roles = rawRoles.map(Number).filter((n) => !Number.isNaN(n));
  const priority = [
    ROLES.ADMIN,
    ROLES.EDITOR,
    ROLES.AGENT,
    ROLES.BDE,
    ROLES.USER,
  ];
  const primaryRoleId =
    priority.find((r) => roles.includes(r)) ?? roles[0] ?? ROLES.USER;

  return {
    userId,
    name: dbUser?.name || reqUser?.name || "User",
    roles,
    role: ROLE_NAMES[primaryRoleId] || "User",
    isAdminOrEditor: roles.some((r) => [ROLES.ADMIN, ROLES.EDITOR].includes(r)),
  };
};

export const buildFormUpdatedMeta = (actor, type, step) => {
  const stepNum = Number(step);
  return {
    at: new Date(),
    step: Number.isFinite(stepNum) ? stepNum : null,
    stepLabel:
      FORM_STEP_LABELS[type]?.[stepNum] ||
      (Number.isFinite(stepNum) ? `Step ${stepNum}` : null),
    updatedBy: actor?.userId || null,
    role: actor?.role || "User",
  };
};

export const sendStructuredError = (
  res,
  statusCode = 400,
  message = "Request failed",
  errors = null,
) => {
  return res.status(statusCode).json({
    status: false,
    success: false,
    message,
    ...(errors ? { errors, data: { errors } } : { data: null }),
  });
};

export const generateUniqueSlug = async (
  Model,
  rawTitle,
  excludeId = null,
  fallbackPrefix = "listing",
) => {
  const baseSlug =
    slugify(String(rawTitle || fallbackPrefix), { lower: true, strict: true }) ||
    fallbackPrefix;

  let candidate = baseSlug;
  let counter = 2;
  while (true) {
    const query = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await Model.findOne(query).select("_id").lean();
    if (!exists) return candidate;
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }
};

export const handleListingControllerError = (
  res,
  error,
  context = "Listing",
  options = {},
) => {
  const {
    duplicateField = "title",
    duplicateMessage = "Listing of this name already exists",
  } = options;

  console.warn(`${context} error:`, error);

  if (error?.name === "ValidationError") {
    const errors = {};
    for (const [key, val] of Object.entries(error.errors || {})) {
      errors[key] = val?.message || "Invalid value";
    }
    const firstMsg = Object.values(errors)[0] || "Validation failed";
    return sendStructuredError(res, 400, firstMsg, errors);
  }

  if (error?.code === 11000) {
    const key =
      Object.keys(error.keyPattern || error.keyValue || {})[0] || duplicateField;

    if (key === "seo.title" || key === "seo_title") {
      const msg = "A listing with this meta title already exists";
      return sendStructuredError(res, 409, msg, { seo_title: msg });
    }

    const mappedKey =
      key === "businessName"
        ? "business_name"
        : key === "slug"
          ? duplicateField
          : key;
    return sendStructuredError(res, 409, duplicateMessage, {
      [mappedKey]: duplicateMessage,
    });
  }

  if (error?.name === "CastError") {
    const field = error.path || "general";
    return sendStructuredError(res, 400, `Invalid value for ${field}`, {
      [field]: `Invalid ${field}`,
    });
  }

  if (error?.name === "MulterError" || error?.code === "LIMIT_FILE_SIZE") {
    const msg =
      error.code === "LIMIT_FILE_SIZE"
        ? "Uploaded file is too large"
        : error.message || "File upload error";
    return sendStructuredError(res, 400, msg, { images: msg });
  }

  const statusCode =
    error?.statusCode && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500;
  const message =
    statusCode < 500 && error?.message
      ? error.message
      : error?.message && process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong on our side. Please try again.";

  return sendStructuredError(res, statusCode, message);
};
