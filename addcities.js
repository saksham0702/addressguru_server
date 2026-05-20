import mongoose from "mongoose";
import dotenv from "dotenv";
import slugify from "slugify";
import City from "./model/CitiesSchema.js";

dotenv.config();

const localitiesMap = {
  Dubai: [
    "Dubai Marina",
    "Downtown Dubai",
    "Business Bay",
    "Jumeirah",
    "Deira",
    "Bur Dubai",
    "Al Barsha",
    "Palm Jumeirah",
    "JVC",
    "International City",
  ],

  "Abu Dhabi": [
    "Khalifa City",
    "Mussafah",
    "Al Reem Island",
    "Saadiyat Island",
    "Yas Island",
    "Mohammed Bin Zayed City",
    "Al Raha",
    "Al Shamkha",
  ],

  Sharjah: [
    "Al Nahda",
    "Muwaileh",
    "Al Majaz",
    "Al Khan",
    "Al Qasimia",
    "Al Taawun",
  ],

  Ajman: [
    "Al Nuaimiya",
    "Al Rashidiya",
    "Al Jurf",
    "Al Mowaihat",
    "Corniche Ajman",
  ],

  "Umm Al Quwain": ["Al Salamah", "Al Raas", "Al Humrah", "Falaj Al Mualla"],

  "Ras Al Khaimah": [
    "Al Hamra",
    "Al Nakheel",
    "Al Dhait",
    "Khuzam",
    "Mina Al Arab",
  ],

  Fujairah: ["Dibba Al Fujairah", "Al Faseel", "Murbah", "Sakamkam", "Madhab"],
};

async function addLocalities() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    console.log("Connected to DB");

    for (const [cityName, localities] of Object.entries(localitiesMap)) {
      // find existing city
      const city = await City.findOne({
        name: cityName,
        deletedAt: null,
      });

      if (!city) {
        console.log(`City not found: ${cityName}`);
        continue;
      }

      // add localities under that city
      for (const localityName of localities) {
        // prevent duplicates
        const alreadyExists = await City.findOne({
          name: localityName,
          parent: city._id,
          deletedAt: null,
        });

        if (alreadyExists) {
          console.log(`Already exists: ${localityName}`);
          continue;
        }

        await City.create({
          name: localityName,

          slug: slugify(localityName, {
            lower: true,
            strict: true,
          }),

          type: "locality",

          parent: city._id,

          status: true,

          added_by: "migration-script",
        });

        console.log(`Added locality "${localityName}" under "${cityName}"`);
      }
    }

    console.log("All localities added successfully");

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

addLocalities();
