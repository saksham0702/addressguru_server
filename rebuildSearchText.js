import mongoose from "mongoose";
import dotenv from "dotenv";

import BusinessListing from "./model/businessListingSchema.js";
import Feature from "./model/featureSchema.js";
import Category from "./model/categoriesSchema.js";
import CitiesSchema from "./model/CitiesSchema.js";

import { buildSearchText } from "./modules/search/search.utils.js";
import { MONGODB_URL } from "./services/constant.js";

dotenv.config();

const run = async () => {
  try {
    console.log("🔌 Connecting DB...");
    await mongoose.connect(MONGODB_URL);

    const listings = await BusinessListing.find({ isDeleted: false });
    console.log(`🔍 Found ${listings.length} listings`);

    for (const listing of listings) {
      try {
        const featureDocs = await Feature.find({
          _id: {
            $in: [
              ...listing.facilities,
              ...listing.services,
              ...listing.courses,
              ...listing.paymentModes,
            ],
          },
        }).select("name");

        const featureNames = featureDocs.map((f) => f.name);

        const categoryDoc = await Category.findById(listing.category);
        const categoryName = categoryDoc?.name?.toLowerCase() || "";

        let cityName = "";
        if (listing.city) {
          const cityDoc = await CitiesSchema.findById(listing.city);
          cityName = cityDoc?.name || "";
        }

        listing.searchText = buildSearchText({
          businessName: listing.businessName,
          description: listing.description,
          categoryName,
          featureNames,
        });

        listing.cityNameLower = cityName.toLowerCase();

        await listing.save();
        console.log(`✅ Updated: ${listing.businessName}`);
      } catch (err) {
        console.error(`❌ Failed: ${listing._id}`, err.message);
      }
    }

    console.log("🎉 DONE");
    process.exit();
  } catch (error) {
    console.error("💥 Script error:", error);
    process.exit(1);
  }
};

run();
