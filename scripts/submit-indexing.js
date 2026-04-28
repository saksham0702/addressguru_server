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

    // Standardize metadata access (handles wrapped and unwrapped responses)
    const statusMetadata = statusResult?.urlNotificationMetadata || statusResult;

    if (statusMetadata && statusMetadata.latestUpdate && statusMetadata.latestUpdate.notifyTime) {
      const notifyTime = new Date(statusMetadata.latestUpdate.notifyTime);

      console.log(`\n⚠️ ALREADY SUBMITTED!`);
      console.log(`This URL was last submitted to Google on: ${notifyTime.toLocaleString()}.`);
      console.log(`Google usually takes a few hours to a few days to crawl and index a page.`);
      console.log(`Please wait patiently. Submitting repeatedly does not speed up the process.\n`);
      return; // Stop here, don't submit again
    }

    // If not found or no valid latestUpdate, then submit
    console.log(`\n🚀 Submitting URL for indexing: ${urlToSubmit} (${type})\n`);
    const notifyResult = await googleIndexingService.notify(urlToSubmit, type);

    if (notifyResult) {
      const notifyMetadata = notifyResult.urlNotificationMetadata || notifyResult;
      
      if (!notifyMetadata.latestUpdate) {
        console.log("✅ Request sent, but Google did not return immediate confirmation metadata.");
        console.log("This is common for first-time submissions or if there's a slight propagation delay.");
        console.log("If this persists, please ensure the Service Account is an 'Owner' of the URL prefix in Google Search Console.");
      } else {
        console.log("✅ Successfully submitted indexing request!");
        console.log("Response Data:");
        console.log(JSON.stringify(notifyResult, null, 2));
      }
      console.log(`\n⏳ Google takes some time to process. Check back in a few hours using this script again.`);
    } else {
      console.log("⚠️ Failed to submit indexing request. Check logs above for details.");
    }
  } catch (error) {
    console.error("❌ Error submitting URL:", error.message);
  }
}

submitForIndexing().catch(console.error);
