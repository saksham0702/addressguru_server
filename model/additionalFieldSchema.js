import mongoose from "mongoose";

const VALID_FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "price",
  "checkbox",
  "dropdown",
];

const additionalFieldSchema = new mongoose.Schema(
  {
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category ID is required"],
      index: true,
    },

    subcategory_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      default: null,
      index: true,
    },

    field_label: {
      type: String,
      required: [true, "Field label is required"],
      trim: true,
    },

    field_type: {
      type: String,
      required: [true, "Field type is required"],
      enum: {
        values: VALID_FIELD_TYPES,
        message: `{VALUE} is not a valid field type. Allowed: ${VALID_FIELD_TYPES.join(", ")}`,
      },
    },

    // ── Options for checkbox / dropdown ──────────────────────────
    checkbox_items: {
      type: [String],
      default: undefined,
      validate: {
        validator: function (value) {
          if (this.field_type === "checkbox") {
            return Array.isArray(value) && value.length > 0;
          }
          return true;
        },
        message: "checkbox_items must have at least one option when field_type is checkbox",
      },
    },

    dropdown_items: {
      type: [String],
      default: undefined,
      validate: {
        validator: function (value) {
          if (this.field_type === "dropdown") {
            return Array.isArray(value) && value.length > 0;
          }
          return true;
        },
        message: "dropdown_items must have at least one option when field_type is dropdown",
      },
    },

    // ── Text / Textarea constraints ───────────────────────────────
    min_length: {
      type: Number,
      default: null,
      min: [0, "Minimum length cannot be negative"],
    },

    max_length: {
      type: Number,
      default: null,
      validate: {
        validator: function (value) {
          if (value !== null && value !== undefined && this.min_length) {
            return value >= this.min_length;
          }
          return true;
        },
        message: "max_length must be greater than or equal to min_length",
      },
    },

    // ── Number / Price constraints ────────────────────────────────
    min_value: {
      type: Number,
      default: null,
    },

    max_value: {
      type: Number,
      default: null,
      validate: {
        validator: function (value) {
          if (value !== null && value !== undefined && this.min_value !== null && this.min_value !== undefined) {
            return value >= this.min_value;
          }
          return true;
        },
        message: "max_value must be greater than or equal to min_value",
      },
    },

    // ── Misc field config ─────────────────────────────────────────
    is_required: { type: Boolean, default: false },

    error_message: { type: String, default: null },
    placeholder: { type: String, default: null, trim: true },
    help_text: { type: String, default: null, trim: true },

    default_value: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    display_order: {
      type: Number,
      default: 0,
      min: [0, "Display order cannot be negative"],
    },

    is_active: { type: Boolean, default: true, index: true },
    show_in_filter: { type: Boolean, default: false },

    is_deleted: { type: Boolean, default: false, index: true },
    deleted_at: { type: Date, default: null },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// ============================================
// INDEXES
// ============================================
additionalFieldSchema.index({ category_id: 1, subcategory_id: 1 });
additionalFieldSchema.index({ category_id: 1, is_active: 1 });
additionalFieldSchema.index({ category_id: 1, display_order: 1 });

// ============================================
// VIRTUALS
// ============================================

// Returns the items array for choice-based fields
additionalFieldSchema.virtual("items").get(function () {
  switch (this.field_type) {
    case "checkbox":
      return this.checkbox_items;
    case "dropdown":
      return this.dropdown_items;
    default:
      return null;
  }
});

// ============================================
// INSTANCE METHODS
// ============================================
additionalFieldSchema.methods.hasItems = function () {
  return ["checkbox", "dropdown"].includes(this.field_type);
};

additionalFieldSchema.methods.validateValue = function (value) {
  const errors = [];

  if (this.is_required && (value === null || value === undefined || value === "")) {
    errors.push(this.error_message || `${this.field_label} is required`);
    return errors;
  }

  if (value === null || value === undefined || value === "") return errors;

  switch (this.field_type) {
    case "text":
    case "textarea":
      if (this.min_length && String(value).length < this.min_length)
        errors.push(`${this.field_label} must be at least ${this.min_length} characters`);
      if (this.max_length && String(value).length > this.max_length)
        errors.push(`${this.field_label} must not exceed ${this.max_length} characters`);
      break;

    case "number": {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        errors.push(`${this.field_label} must be a valid number`);
      } else {
        if (this.min_value !== null && numValue < this.min_value)
          errors.push(`${this.field_label} must be at least ${this.min_value}`);
        if (this.max_value !== null && numValue > this.max_value)
          errors.push(`${this.field_label} must not exceed ${this.max_value}`);
      }
      break;
    }

    case "price": {
      // value = { amount: string|number, currency: string }
      if (typeof value !== "object" || Array.isArray(value)) {
        errors.push(`${this.field_label} must be an object with amount and currency`);
        break;
      }
      const { amount, currency } = value;
      if (!currency || typeof currency !== "string") {
        errors.push(`${this.field_label} requires a valid currency`);
      }
      const numAmount = Number(amount);
      if (amount === undefined || amount === null || amount === "" || isNaN(numAmount)) {
        errors.push(`${this.field_label} must have a valid amount`);
      } else {
        if (this.min_value !== null && numAmount < this.min_value)
          errors.push(`${this.field_label} must be at least ${this.min_value}`);
        if (this.max_value !== null && numAmount > this.max_value)
          errors.push(`${this.field_label} must not exceed ${this.max_value}`);
      }
      break;
    }

    case "checkbox":
      if (!Array.isArray(value)) {
        errors.push(`${this.field_label} must be an array`);
      } else {
        const validItems = this.items || [];
        const invalidItems = value.filter((item) => !validItems.includes(item));
        if (invalidItems.length > 0)
          errors.push(`${this.field_label} contains invalid options: ${invalidItems.join(", ")}`);
      }
      break;

    case "dropdown": {
      const validOptions = this.items || [];
      if (!validOptions.includes(value))
        errors.push(`${this.field_label} contains an invalid option`);
      break;
    }
  }

  return errors;
};

// ============================================
// STATIC METHODS
// ============================================
additionalFieldSchema.statics.getFieldsForCategory = async function (
  categoryId,
  subcategoryId = null,
) {
  return this.find({
    category_id: categoryId,
    subcategory_id: subcategoryId,
    is_active: true,
    is_deleted: false,
  }).sort({ display_order: 1 });
};

additionalFieldSchema.statics.getFilterFields = async function (
  categoryId,
  subcategoryId = null,
) {
  return this.find({
    category_id: categoryId,
    subcategory_id: subcategoryId,
    is_active: true,
    is_deleted: false,
    show_in_filter: true,
  }).sort({ display_order: 1 });
};

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================
additionalFieldSchema.pre("save", function (next) {
  // Clear items that don't belong to this field type
  if (this.field_type !== "checkbox") this.checkbox_items = undefined;
  if (this.field_type !== "dropdown") this.dropdown_items = undefined;

  // Clear constraints that don't apply to this field type
  if (!["text", "textarea"].includes(this.field_type)) {
    this.min_length = null;
    this.max_length = null;
  }
  if (!["number", "price"].includes(this.field_type)) {
    this.min_value = null;
    this.max_value = null;
  }

  next();
});

const AdditionalField = mongoose.model("AdditionalField", additionalFieldSchema);
export default AdditionalField;