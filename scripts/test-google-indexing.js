import googleIndexingService from "../services/googleIndexing.service.js";
import * as dotenv from "dotenv";
dotenv.config();

async function testIndexing() {
  console.log("Starting Google Indexing API Test...");

  const testUrls = [
    { url: "https://addressguru.ae/blog/test-blog-post", type: "URL_UPDATED" },
    { url: "https://addressguru.ae/business/test-business-listing", type: "URL_UPDATED" },
    { url: "https://addressguru.ae/job/test-job-listing", type: "URL_DELETED" }
  ];

  for (const item of testUrls) {
    console.log(`\nTesting ${item.type} for: ${item.url}`);
    try {
      const result = await googleIndexingService.notify(item.url, item.type);
      if (result) {
        console.log("Result:", result);
      } else {
        console.log("Check logs above for reasons why it skipped or failed.");
      }
    } catch (error) {
      console.warn("Test failed with error:", error.message);
    }
  }

  console.log("\nTest completed.");
}

testIndexing().catch(console.warn);
