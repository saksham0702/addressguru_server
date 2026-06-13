import mongoose from "mongoose";
import dotenv from "dotenv";
import Plan from "../model/plansSchema.js";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URL;

const jobPlans = [
  {
    name: "Free Job Plan",
    slug: "job-free",
    planCode: "JOB_FREE",
    planType: "job",
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
    features: ["1 Job Post", "Limited Visibility"],
    limits: {},
    flags: {},
  },
  {
    name: "Starter Job Plan",
    slug: "job-starter",
    planCode: "JOB_STARTER",
    planType: "job",
    currency: "AED",
    price: 99,
    billingCycle: "month",
    displayOrder: 2,
    tagline: "",
    theme: "blue",
    ctaLabel: "Post Jobs",
    isHighlighted: false,
    isActive: true,
    isDeleted: false,
    features: ["10 Job Posts", "100 Phone Number Views"],
    limits: {},
    flags: {},
  },
  {
    name: "Pro Job Plan",
    slug: "job-pro",
    planCode: "JOB_PRO",
    planType: "job",
    currency: "AED",
    price: 199,
    billingCycle: "month",
    displayOrder: 3,
    tagline: "Most Popular",
    theme: "green",
    ctaLabel: "Post Jobs",
    isHighlighted: true,
    isActive: true,
    isDeleted: false,
    features: ["Unlimited Job Posts", "Unlimited Number Views"],
    limits: {},
    flags: {},
  },
];

const marketplacePlans = [
  {
    name: "Free Marketplace Plan",
    slug: "marketplace-free",
    planCode: "MARKETPLACE_FREE",
    price: 0,
    planType: "marketplace",
    billingCycle: "one_time",
    features: ["1 Ad Post", "Standard Visibility"],
    isActive: true,
  },
  {
    name: "Basic Ad Plan",
    slug: "marketplace-basic",
    planCode: "MARKETPLACE_BASIC",
    price: 46,
    planType: "marketplace",
    billingCycle: "one_time",
    durationInDays: 7,
    features: ["1 Ad Post", "Live for 7 Days"],
    isActive: true,
  },
  {
    name: "Standard Ad Plan",
    slug: "marketplace-standard",
    planCode: "MARKETPLACE_STANDARD",
    price: 99,
    planType: "marketplace",
    billingCycle: "one_time",
    durationInDays: 31,
    features: ["2 Ad Posts", "Live for 31 Days"],
    isActive: true,
  },
  {
    name: "Growth Ad Plan",
    slug: "marketplace-growth",
    planCode: "MARKETPLACE_GROWTH",
    price: 299,
    planType: "marketplace",
    billingCycle: "one_time",
    durationInDays: 90,
    features: ["5 Ad Posts", "Live for 90 Days"],
    isActive: true,
  },
  {
    name: "Premium Ad Plan",
    slug: "marketplace-premium",
    planCode: "MARKETPLACE_PREMIUM",
    price: 499,
    planType: "marketplace",
    billingCycle: "one_time",
    durationInDays: 90,
    features: ["20 Ad Posts", "Live for 90 Days"],
    isActive: true,
  },
];

async function seedPlans() {
  try {
    await mongoose.connect(MONGO_URI);
    // console.log("Connected to MongoDB");
    const slugs = [...jobPlans, ...marketplacePlans].map((p) => p.slug);
    await Plan.deleteMany({ slug: { $in: slugs } });
    // console.log("Cleaned up existing specific job and marketplace plans");

    await Plan.insertMany([...jobPlans, ...marketplacePlans]);
    // console.log("Successfully seeded Job and Marketplace plans!");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding plans:", error);
    process.exit(1);
  }
}

seedPlans();
