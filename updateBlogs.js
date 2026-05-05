import mongoose from "mongoose";
import Blog from "./model/blogsSchema.js";
import { MONGODB_URL } from "./services/constant.js";

// 🔥 PUT YOUR USER ID HERE
const NEW_AUTHOR_ID = "69c52beca42186c1db5896eb";

// 🔗 Mongo connection
const MONGO_URI = MONGODB_URL;

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to DB");

    // 🧠 Update ALL blogs
    const result = await Blog.updateMany(
      {},
      {
        $set: {
          author: NEW_AUTHOR_ID,
        },
      },
    );

    console.log("🎉 Blogs updated:", result.modifiedCount);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();
