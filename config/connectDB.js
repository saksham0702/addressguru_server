import CitiesSchema from "../model/CitiesSchema.js";
import userSchema from "../model/userSchema.js";
import { defaultCities, MONGODB_URL } from "../services/constant.js";
import logger from "../services/logger.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
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
    console.error("❌ MongoDB connection error:", err.message);
    logger.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    console.log("⚠️ MongoDB disconnected");
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
    console.error("Error creating master admin:", error);
  }
  //  finally {
  //   mongoose.connection.close();
  // }
};

export default connectDB;
