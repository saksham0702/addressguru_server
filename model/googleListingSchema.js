import mongoose from "mongoose";

const googleListingSchema = new mongoose.Schema(
  {
    placeId: {
      type: String,
      required: true,
      index: true,
    },

    name: { type: String, required: true },

    address: { type: String, required: true },

    rating: { type: Number, min: 0, max: 5 },

    phoneNumber: { type: String },

    website: { type: String },

    totalReviews: { type: Number },

    photos: [Object],

    reviews: [
      {
        author_name: String,
        rating: Number,
        text: String,
        time: Number,
      },
    ],

    emails: [
      {
        email: String,
        status: String,
        lastUpdated: String,
      },
    ],

    phoneNumbers: [{ type: String }],

    query: { type: String },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },

    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

googleListingSchema.index({ placeId: 1, query: 1 });

export default mongoose.model("GoogleListing", googleListingSchema);