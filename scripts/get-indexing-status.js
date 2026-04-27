import googleIndexingService from "../services/googleIndexing.service.js";
import * as dotenv from "dotenv";
dotenv.config();

async function checkStatus() {
  const urlToCheck = process.argv[2];
  
  if (!urlToCheck) {
    console.error("❌ Please provide a URL to check.");
    console.error("Usage: node get-indexing-status.js <url>");
    console.error("Example: node get-indexing-status.js https://addressguru.ae/blog/test-blog-post");
    process.exit(1);
  }

  console.log(`🔍 Checking Google Indexing status for: ${urlToCheck}\n`);
  
  try {
    const statusResult = await googleIndexingService.getStatus(urlToCheck);
    
    if (statusResult) {
      console.log("✅ Previous Indexing Request Details:");
      console.log("--------------------------------------------------");
      console.log(`URL: ${statusResult.url}`);
      
      if (statusResult.latestUpdate) {
        console.log(`Type: ${statusResult.latestUpdate.type}`);
        console.log(`Notify Time: ${new Date(statusResult.latestUpdate.notifyTime).toLocaleString()}`);
      } else {
        console.log("No previous update data found for this URL.");
      }
      
      console.log("--------------------------------------------------");
      console.log("Raw Response Metadata:");
      console.log(JSON.stringify(statusResult, null, 2));
    } else {
      console.log("⚠️ No metadata found or an error occurred.");
    }
  } catch (error) {
    console.error("❌ Error fetching status:", error.message);
  }
}

checkStatus().catch(console.error);
