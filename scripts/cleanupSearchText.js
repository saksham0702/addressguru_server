import mongoose from "mongoose";
import * as dotenv from "dotenv";
import BusinessListing from "../model/businessListingSchema.js";
import Category from "../model/categoriesSchema.js";

dotenv.config();

const MONGODB_URL = process.env.MONGODB_URL;

if (!MONGODB_URL) {
  console.error("❌ MONGODB_URL not found in environment");
  process.exit(1);
}

const cleanupSearchText = async () => {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log("✅ Connected to MongoDB");

    const listings = await BusinessListing.find({ isDeleted: false }).populate("category");
    console.log(`🔍 Found ${listings.length} listings to update`);

    let updatedCount = 0;

    for (const listing of listings) {
      const businessName = listing.businessName || "";
      const categoryName = listing.category?.name || "";
      const tags = listing.category?.tags || [];

      // Simplified searchText: Name + Category Name + Tags
      const newSearchText = [
        businessName,
        categoryName,
        ...tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

      listing.searchText = newSearchText;
      await listing.save();
      updatedCount++;

      if (updatedCount % 100 === 0) {
        console.log(`⏳ Updated ${updatedCount} listings...`);
      }
    }

    console.log(`✅ Successfully updated ${updatedCount} listings!`);
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Connection closed");
  }
};

cleanupSearchText();
