import mongoose from "mongoose";
import dotenv from "dotenv";
import Plan from "../model/plansSchema.js";
dotenv.config();

const MONGO_URI =
  "mongodb://db_admin:J08}t!Yi7b-W)3}@serpsuggest.com:27017/ag_uae";

const propertyPlans = [
  {
    name: "Free Property Plan",
    slug: "property-free",
    planCode: "PROPERTY_FREE",
    planType: "property",
    currency: "AED",
    price: 0,
    billingCycle: "one_time",
    displayOrder: 1,
    tagline: "",
    theme: "default",
    ctaLabel: "Get Started",
    isHighlighted: false,
    isActive: true,
    isDeleted: false,
    features: ["1 Property Listing", "Standard Visibility"],
    limits: {
      descriptionWords: 200,
      businessImages: 5,
    },
    flags: {
      websiteLinkAllowed: false,
      imagesGalleryAllowed: true,
      videoLinkAllowed: false,
    },
  },
];

async function seedPlans() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    for (const plan of propertyPlans) {
      await Plan.findOneAndUpdate({ slug: plan.slug }, plan, {
        upsert: true,
        new: true,
      });
      console.log(`Seeded/Updated plan: ${plan.name}`);
    }

    console.log("Successfully seeded Property plans!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding plans:", error);
    process.exit(1);
  }
}

seedPlans();
