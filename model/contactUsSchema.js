import mongoose from "mongoose";

const contactUsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      maxlength: 150,
    },
    countryCode: {
      type: String,
      default: "+971",
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
      maxlength: 20,
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "General Inquiry",
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["pending", "replied", "closed"],
      default: "pending",
      index: true,
    },
    adminNote: {
      type: String,
      trim: true,
      default: "",
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

contactUsSchema.index({ createdAt: -1 });
contactUsSchema.index({ email: 1 });
contactUsSchema.index({ status: 1 });

const ContactUs = mongoose.models.ContactUs || mongoose.model("ContactUs", contactUsSchema);
export default ContactUs;

