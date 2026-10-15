import CitiesSchema from "../model/CitiesSchema.js";
import userSchema from "../model/userSchema.js";
import { defaultCities, MONGODB_URL } from "../services/constant.js";
import logger from "../services/logger.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

const connectDB = async () => {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  try {
    await mongoose.connect(MONGODB_URL, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    for (const city of defaultCities) {
      const exists = await CitiesSchema.findOne({ slug: city.slug });
      if (!exists) {
        await CitiesSchema.create({
          ...city,
          status: true,
          added_by: "system",
        });
        console.log(`✅ Added city: ${city.name}`);
      } else {
        // console.log(`⚠️ City already exists: ${city.name}`);
      }
    }

    function dim(text) {
      return `\x1b[32m${text}\x1b[0m`;
    }

    console.log(`${dim("✅ MongoDB connected successfully")}`);
    logger.info("✅ MongoDB connected successfully");
  } catch (err) {
    console.warn("❌ MongoDB connection error:", err.message);
    logger.error("❌ MongoDB connection error:", err.message);
    console.log("🔄 Retrying MongoDB connection in 5 seconds...");
    setTimeout(connectDB, 5000);
  }

  mongoose.connection.on("disconnected", () => {
    console.log("⚠️ MongoDB disconnected");
  });
  mongoose.connection.on("error", (err) => {
    console.warn("⚠️ MongoDB connection event error:", err.message);
  });
};

const createMasterAdmin = async () => {
  try {
    const email = "master@admin.com";
    const plainPassword = "12345678";
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const adminExists = await userSchema.findOne({ email });
    if (adminExists) {
      console.log("Master admin already exists.");
      return;
    }

    const newAdmin = new userSchema({
      name: "Master Admin",
      email,
      password: hashedPassword,
      role: 1,
      phone: 9340679596,
    });

    await newAdmin.save();
    console.log("Master admin created successfully!");
  } catch (error) {
    console.warn("Error creating master admin:", error);
  }
  //  finally {
  //   mongoose.connection.close();
  // }
};

export default connectDB;
