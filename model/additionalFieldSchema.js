import mongoose from "mongoose";

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

    // field_name: {
    //   type: String,
    //   // required: [true, "Field name is required"],
    //   trim: true,
    //   lowercase: true,
    //   match: [
    //     /^[a-z_]+$/,
    //     "Field name must contain only lowercase letters and underscores",
    //   ],
    // },

    field_label: {
      type: String,
      required: [true, "Field label is required"],
      trim: true,
    },

    field_type: {
      type: String,
      required: [true, "Field type is required"],
      enum: {
        values: [
          "text",
          "textarea",
          "number",
          "email",
          "url",
          "date",
          "time",
          "checkbox",
          "radio",
          "dropdown",
          "file",
          "color",
        ],
        message: "{VALUE} is not a valid field type",
      },
    },

    checkbox_items: {
      type: [String],
      default: undefined,
      validate: {
        validator: function (value) {
          if (this.field_type === "checkbox") {
            return value && value.length > 0;
          }
          return true;
        },
        message:
          "checkbox_items must have at least one option when field_type is checkbox",
      },
    },

    radio_items: {
      type: [String],
      default: undefined,
      validate: {
        validator: function (value) {
          if (this.field_type === "radio") {
            return value && value.length > 0;
          }
          return true;
        },
        message:
          "radio_items must have at least one option when field_type is radio",
      },
    },

    dropdown_items: {
      type: [String],
      default: undefined,
      validate: {
        validator: function (value) {
          if (this.field_type === "dropdown") {
            return value && value.length > 0;
          }
          return true;
        },
        message:
          "dropdown_items must have at least one option when field_type is dropdown",
      },
    },

    is_required: { type: Boolean, default: false },

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
          if (value && this.min_length) return value >= this.min_length;
          return true;
        },
        message: "max_length must be greater than or equal to min_length",
      },
    },

    min_value: { type: Number, default: null },

    max_value: {
      type: Number,
      default: null,
      validate: {
        validator: function (value) {
          if (value && this.min_value) return value >= this.min_value;
          return true;
        },
        message: "max_value must be greater than or equal to min_value",
      },
    },

    validation_type: { type: String, default: null },
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
additionalFieldSchema.index(
  { category_id: 1, subcategory_id: 1,  },
  { unique: true },
);

// ============================================
// VIRTUALS
// ============================================
additionalFieldSchema.virtual("items").get(function () {
  switch (this.field_type) {
    case "checkbox":
      return this.checkbox_items;
    case "radio":
      return this.radio_items;
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
  return ["checkbox", "radio", "dropdown"].includes(this.field_type);
};

additionalFieldSchema.methods.validateValue = function (value) {
  const errors = [];

  if (this.is_required && (!value || value === "")) {
    errors.push(this.error_message || `${this.field_label} is required`);
    return errors;
  }

  if (!value) return errors;

  switch (this.field_type) {
    case "text":
    case "textarea":
    case "email":
    case "url":
      if (this.min_length && value.length < this.min_length)
        errors.push(
          `${this.field_label} must be at least ${this.min_length} characters`,
        );
      if (this.max_length && value.length > this.max_length)
        errors.push(
          `${this.field_label} must not exceed ${this.max_length} characters`,
        );
      if (this.pattern && !new RegExp(this.pattern).test(value))
        errors.push(
          this.error_message || `${this.field_label} format is invalid`,
        );
      break;

    case "number":
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

    case "checkbox":
      if (!Array.isArray(value)) {
        errors.push(`${this.field_label} must be an array`);
      } else {
        const validItems = this.items || [];
        const invalidItems = value.filter((item) => !validItems.includes(item));
        if (invalidItems.length > 0)
          errors.push(
            `${this.field_label} contains invalid options: ${invalidItems.join(", ")}`,
          );
      }
      break;

    case "radio":
    case "dropdown":
      const validOptions = this.items || [];
      if (!validOptions.includes(value))
        errors.push(`${this.field_label} contains an invalid option`);
      break;
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
  if (this.field_type !== "checkbox") this.checkbox_items = undefined;
  if (this.field_type !== "radio") this.radio_items = undefined;
  if (this.field_type !== "dropdown") this.dropdown_items = undefined;
  next();
});

const AdditionalField = mongoose.model(
  "AdditionalField",
  additionalFieldSchema,
);
export default AdditionalField;
