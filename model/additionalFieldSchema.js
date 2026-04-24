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

    // ✅ BOOLEAN LOCATIONS
    is_logo: { type: Boolean, default: false, index: true },
    is_quickinfo: { type: Boolean, default: false, index: true },
    is_description: { type: Boolean, default: false, index: true },
    is_additional: { type: Boolean, default: false, index: true },

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
        message:
          "checkbox_items must have at least one option when field_type is checkbox",
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
        message:
          "dropdown_items must have at least one option when field_type is dropdown",
      },
    },

    is_required: { type: Boolean, default: false },
    placeholder: { type: String, default: null, trim: true },
    is_active: { type: Boolean, default: true, index: true },
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

// INDEXES
additionalFieldSchema.index({ category_id: 1, subcategory_id: 1 });
additionalFieldSchema.index({ category_id: 1, is_active: 1 });

// VIRTUAL
additionalFieldSchema.virtual("items").get(function () {
  if (this.field_type === "checkbox") return this.checkbox_items;
  if (this.field_type === "dropdown") return this.dropdown_items;
  return null;
});

// ✅ ENSURE ONLY ONE LOCATION IS TRUE
additionalFieldSchema.pre("validate", function (next) {
  const locations = [
    this.is_logo,
    this.is_quickinfo,
    this.is_description,
    this.is_additional,
  ];

  const trueCount = locations.filter(Boolean).length;

  if (trueCount > 1) {
    return next(new Error("Only one location can be true"));
  }

  // Optional: if none selected → default to additional
  if (trueCount === 0) {
    this.is_additional = true;
  }

  next();
});

// VALIDATION METHOD
additionalFieldSchema.methods.validateValue = function (value) {
  const errors = [];

  if (
    this.is_required &&
    (value === null || value === undefined || value === "")
  ) {
    errors.push(this.error_message || `${this.field_label} is required`);
    return errors;
  }

  if (value === null || value === undefined || value === "") return errors;

  switch (this.field_type) {
    case "number":
      if (isNaN(Number(value))) {
        errors.push(`${this.field_label} must be a valid number`);
      }
      break;

    case "price":
      if (typeof value !== "object" || Array.isArray(value)) {
        errors.push(
          `${this.field_label} must be an object with amount and currency`,
        );
        break;
      }
      const { amount, currency } = value;

      if (!currency) errors.push(`${this.field_label} requires currency`);
      if (isNaN(Number(amount)))
        errors.push(`${this.field_label} must have a valid amount`);
      break;

    case "checkbox":
      if (!Array.isArray(value)) {
        errors.push(`${this.field_label} must be an array`);
      }
      break;

    case "dropdown":
      if (!this.items?.includes(value)) {
        errors.push(`${this.field_label} contains invalid option`);
      }
      break;
  }

  return errors;
};

// PRE SAVE CLEANUP
additionalFieldSchema.pre("save", function (next) {
  if (this.field_type !== "checkbox") this.checkbox_items = undefined;
  if (this.field_type !== "dropdown") this.dropdown_items = undefined;
  next();
});

const AdditionalField = mongoose.model(
  "AdditionalField",
  additionalFieldSchema,
);
export default AdditionalField;
