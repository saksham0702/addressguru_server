import mongoose from 'mongoose';
import slugify from 'slugify';
// // Replace with your actual connection string and model
// const MONGO_URI = 'mongodb://db_admin:J08}t!Yi7b-W)3}@serpsuggest.com:27017/ag_uae';

// async function migrateSlugs() {
//   await mongoose.connect(MONGO_URI);
//   console.log('Connected to MongoDB');

//   const db = mongoose.connection.db;
//   const collection = db.collection('businesslistings'); // 🔁 change to your collection name

//   const listings = await collection.find({}).toArray();
//   console.log(`Found ${listings.length} listings`);

//   let updated = 0;
//   let skipped = 0;
//   const duplicates = [];

//   for (const listing of listings) {
//     const businessName = listing.business_name;

//     if (!businessName) {
//       skipped++;
//       continue;
//     }

//     const newSlug = slugify(businessName, { lower: true, strict: true });

//     // Check if another document already has this slug (to avoid duplicates)
//     const existing = await collection.findOne({
//       slug: newSlug,
//       _id: { $ne: listing._id }
//     });

//     if (existing) {
//       console.warn(`⚠️  Duplicate slug "${newSlug}" for: ${listing._id} — skipping`);
//       duplicates.push({ id: listing._id, name: businessName, slug: newSlug });
//       skipped++;
//       continue;
//     }

//     await collection.updateOne(
//       { _id: listing._id },
//       { $set: { slug: newSlug } }
//     );

//     console.log(`✅ ${listing.slug} → ${newSlug}`);
//     updated++;
//   }

//   console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}`);

//   if (duplicates.length > 0) {
//     console.log('\n⚠️  Duplicates that need manual review:');
//     console.table(duplicates);
//   }

//   await mongoose.disconnect();
// }

// migrateSlugs().catch(console.error);



const MONGO_URI = 'mongodb://db_admin:J08}t!Yi7b-W)3}@serpsuggest.com:27017/ag_uae';

async function migrateSlugs() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const collection = db.collection('businesslistings'); // 🔁 change to your actual collection name

  const listings = await collection.find({}).toArray();
  console.log(`Found ${listings.length} listings`);

  let updated = 0;
  let skipped = 0;
  const duplicates = [];

  for (const listing of listings) {
    const businessName = listing.businessName; // ✅ your field is businessName not business_name

    if (!businessName) {
      console.log(`Skipping ${listing._id} — no businessName`);
      skipped++;
      continue;
    }

    const newSlug = slugify(businessName, { lower: true, strict: true });

    // Skip if slug is already clean (no timestamp suffix)
    if (listing.slug === newSlug) {
      skipped++;
      continue;
    }

    // Check for duplicates
    const existing = await collection.findOne({
      slug: newSlug,
      _id: { $ne: listing._id }
    });

    if (existing) {
      console.warn(`⚠️  Duplicate slug "${newSlug}" for _id: ${listing._id} — skipping`);
      duplicates.push({ id: listing._id, name: businessName, slug: newSlug });
      skipped++;
      continue;
    }

    await collection.updateOne(
      { _id: listing._id },
      { $set: { slug: newSlug } }
    );

    console.log(`✅ "${listing.slug}"  →  "${newSlug}"`);
    updated++;
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}`);

  if (duplicates.length > 0) {
    console.log('\n⚠️  These need manual review (duplicate slugs):');
    console.table(duplicates);
  }

  await mongoose.disconnect();
}

migrateSlugs().catch(console.error);