import mongoose from "mongoose";
import dotenv from "dotenv";
import Category from "../model/categoriesSchema.js";

dotenv.config();

const MONGO_URI =
  "mongodb://db_admin:J08}t!Yi7b-W)3}@serpsuggest.com:27017/ag_uae";

const propertyCategories = [
  {
    name: "Apartments",
    slug: "apartments",
    type: "property",
  },
  {
    name: "Villas & Houses",
    slug: "villas-houses",
    type: "property",
  },
  {
    name: "Townhouses",
    slug: "townhouses",
    type: "property",
  },
  {
    name: "Rooms & Bed Spaces",
    slug: "rooms-bed-spaces",
    type: "property",
  },
  {
    name: "Offices",
    slug: "offices",
    type: "property",
  },
  {
    name: "Shops & Commercial Spaces",
    slug: "shops-commercial",
    type: "property",
  },
  {
    name: "Land & Plots",
    slug: "land-plots",
    type: "property",
  },
  {
    name: "Buildings & Warehouses",
    slug: "buildings-warehouses",
    type: "property",
  },
];

async function seedPropertyCategories() {
  try {
    await mongoose.connect(MONGO_URI);

    console.log("Connected to MongoDB");

    for (const category of propertyCategories) {
      await Category.findOneAndUpdate({ slug: category.slug }, category, {
        upsert: true,
        new: true,
      });

      console.log(`Seeded: ${category.name}`);
    }

    console.log("Property categories seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding property categories:", error);
    process.exit(1);
  }
}

seedPropertyCategories();
