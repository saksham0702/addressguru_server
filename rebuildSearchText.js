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

    let updated = 0;
    let failed = 0;

    for (const listing of listings) {
      try {
        // ── Only services + courses (NO facilities, NO paymentModes) ──────
        const featureDocs = await Feature.find({
          _id: {
            $in: [...listing.services, ...listing.courses],
          },
        }).select("name");

        const serviceAndCourseNames = featureDocs.map((f) => f.name);

        // ── Category name ─────────────────────────────────────────────────
        const categoryDoc = await Category.findById(listing.category);
        const categoryName = categoryDoc?.name?.toLowerCase() || "";

        // ── City (stored separately, NOT inside searchText) ───────────────
        let cityName = "";
        if (listing.city) {
          const cityDoc = await CitiesSchema.findById(listing.city);
          cityName = cityDoc?.name || "";
        }

        // ── Build searchText: name + category + services/courses only ─────
        listing.searchText = buildSearchText({
          businessName: listing.businessName,
          description: "", // ← removed
          categoryName,
          featureNames: serviceAndCourseNames,
        });

        // ── City stored separately for strict city filtering ──────────────
        listing.cityNameLower = cityName.toLowerCase();

        await listing.save();
        console.log(`✅ [${++updated}] ${listing.businessName}`);
      } catch (err) {
        failed++;
        console.error(`❌ Failed: ${listing._id} — ${err.message}`);
      }
    }

    console.log(`\n🎉 DONE — ${updated} updated, ${failed} failed`);
    process.exit();
  } catch (error) {
    console.error("💥 Script error:", error);
    process.exit(1);
  }
};

run();
