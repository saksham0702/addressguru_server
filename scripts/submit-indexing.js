import googleIndexingService from "../services/googleIndexing.service.js";
import * as dotenv from "dotenv";
dotenv.config();

async function submitForIndexing() {
  const urlToSubmit = process.argv[2];
  const type = process.argv[3] || 'URL_UPDATED'; // URL_UPDATED or URL_DELETED
  
  if (!urlToSubmit) {
    console.error("❌ Please provide a URL to submit.");
    console.error("Usage: node submit-indexing.js <url> [type]");
    console.error("Example: node submit-indexing.js https://addressguru.ae/blog/test-blog-post URL_UPDATED");
    process.exit(1);
  }

  console.log(`🔍 Checking current status for: ${urlToSubmit}...`);
  
  try {
    // Check status first
    const statusResult = await googleIndexingService.getStatus(urlToSubmit);
    
    if (statusResult && statusResult.latestUpdate && statusResult.latestUpdate.notifyTime) {
      const notifyTime = new Date(statusResult.latestUpdate.notifyTime);
      
      console.log(`\n⚠️ ALREADY SUBMITTED!`);
      console.log(`This URL has already been submitted to Google on: ${notifyTime.toLocaleString()}.`);
      console.log(`Google usually takes a few hours to a few days to crawl and index a page.`);
      console.log(`Please wait patiently. Submitting repeatedly does not speed up the indexing process.\n`);
      return; // Stop here, don't submit again
    }

    // If not found or no valid latestUpdate, then submit
    console.log(`\n🚀 Submitting URL for indexing: ${urlToSubmit} (${type})\n`);
    const notifyResult = await googleIndexingService.notify(urlToSubmit, type);
    
    if (notifyResult) {
      if (notifyResult.urlNotificationMetadata && !notifyResult.urlNotificationMetadata.latestUpdate) {
        console.log("⚠️ Successfully submitted BUT Google dropped the request!");
        console.log("Reason: Please check your Google Search Console. The URL prefix is either not verified or the Service Account is not an Owner.");
      } else {
        console.log("✅ Successfully submitted indexing request!");
        console.log("Response Data:");
        console.log(JSON.stringify(notifyResult, null, 2));
        console.log(`\n⏳ It is now indexing. Google takes some time to process, please be patient.`);
      }
    } else {
      console.log("⚠️ Failed to submit indexing request.");
    }
  } catch (error) {
    console.error("❌ Error submitting URL:", error.message);
  }
}

submitForIndexing().catch(console.error);
