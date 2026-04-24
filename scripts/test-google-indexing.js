import googleIndexingService from "../services/googleIndexing.service.js";
import * as dotenv from "dotenv";
dotenv.config();

async function testIndexing() {
  console.log("Starting Google Indexing API Test...");

  const testUrls = [
    { url: "https://addressguru.ae/blog/test-blog-post", type: "URL_UPDATED" },
    // { url: "https://addressguru.ae/business/test-business-listing", type: "URL_UPDATED" },
    // { url: "https://addressguru.ae/job/test-job-listing", type: "URL_DELETED" }
  ];

  for (const item of testUrls) {
    console.log(`\n--- Testing URL: ${item.url} ---`);
    try {
      // 1. Notify Google
      console.log(`Notifying Google: ${item.type}...`);
      const notifyResult = await googleIndexingService.notify(item.url, item.type);
      if (notifyResult) {
        console.log("Notification Success:", notifyResult);
      }

      // 2. Check Status
      console.log(`Checking Status...`);
      const statusResult = await googleIndexingService.getStatus(item.url);
      if (statusResult) {
        console.log("Status Metadata:", statusResult);
      }
    } catch (error) {
      console.warn("Test failed with error:", error.message);
    }
  }

  console.log("\nTest completed.");
}

testIndexing().catch(console.warn);
