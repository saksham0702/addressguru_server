import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { GOOGLE_INDEXING_SERVICE_PATH } from './constant.js';

/**
 * Service to handle Google Indexing API notifications.
 * To use this service, you need a Service Account JSON key file placed at `config/service-account.json`
 * or set the environment variables GOOGLE_INDEXING_EMAIL and GOOGLE_INDEXING_PRIVATE_KEY.
 */
class GoogleIndexingService {
  constructor() {
    this.jwtClient = null;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;
    try {


      const serviceAccountPath =
        GOOGLE_INDEXING_SERVICE_PATH ||
        path.join(process.cwd(), "config/service-account.json");

      if (!fs.existsSync(serviceAccountPath)) {
        console.warn("⚠️ Google indexing service account file not found");
        return null;
      }


      let credentials = null;

      if (fs.existsSync(serviceAccountPath)) {
        const keyFileContent = fs.readFileSync(serviceAccountPath, 'utf8');
        const credentials = JSON.parse(keyFileContent);
        this.jwtClient = google.auth.fromJSON(credentials);
        this.jwtClient.scopes = ['https://www.googleapis.com/auth/indexing'];

        await this.jwtClient.authorize();
        this.isInitialized = true;
      } else if (process.env.GOOGLE_INDEXING_EMAIL && process.env.GOOGLE_INDEXING_PRIVATE_KEY) {
        this.jwtClient = new google.auth.JWT(
          process.env.GOOGLE_INDEXING_EMAIL,
          null,
          process.env.GOOGLE_INDEXING_PRIVATE_KEY.replace(/\\n/g, '\n'),
          ['https://www.googleapis.com/auth/indexing']
        );
        await this.jwtClient.authorize();
        this.isInitialized = true;
      } else {
        console.warn('[GoogleIndexingService] Credentials not found. Service will not be active.');
      }
    } catch (error) {
      console.warn('[GoogleIndexingService] Error initializing service:', error);
    }
  }

  /**
   * Notify Google about a URL update or deletion.
   * @param {string} url The URL to index or remove.
   * @param {'URL_UPDATED' | 'URL_DELETED'} type The notification type.
   */
  async notify(url, type = 'URL_UPDATED') {
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.jwtClient) {
      console.warn(`[GoogleIndexingService] Service not active. Skipping notification for: ${url}`);
      return;
    }

    try {
      console.log(`[GoogleIndexingService] Notifying Google: ${type} - ${url}`);

      const indexing = google.indexing('v3');
      const response = await indexing.urlNotifications.publish({
        auth: this.jwtClient,
        requestBody: {
          url: url,
          type: type,
        },
      });

      if (process.env.DEBUG_GOOGLE_INDEXING) {
        console.log(`[GoogleIndexingService] Raw Response for ${url}:`, JSON.stringify(response.data, null, 2));
      }
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      console.warn(`[GoogleIndexingService] Error for ${url}:`, errorMessage);
      // We don't necessarily want to crash the whole request if indexing fails
      return null;
    }
  }

  /**
   * Check the status of a URL in the Indexing API.
   * This returns metadata about the last time Google was notified about this URL.
   * Note: This does NOT tell you if the page is currently indexed in Search results,
   * only if the API has received notifications for it.
   * @param {string} url The URL to check.
   */
  async getStatus(url) {
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.jwtClient) {
      console.warn(`[GoogleIndexingService] Service not active. Cannot check status for: ${url}`);
      return null;
    }

    try {
      console.log(`[GoogleIndexingService] Checking status for: ${url}`);

      const indexing = google.indexing('v3');
      const response = await indexing.urlNotifications.getMetadata({
        auth: this.jwtClient,
        url: url,
      });

      if (process.env.DEBUG_GOOGLE_INDEXING) {
        console.log(`[GoogleIndexingService] Raw Status for ${url}:`, JSON.stringify(response.data, null, 2));
      }
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      console.warn(`[GoogleIndexingService] Error checking status for ${url}:`, errorMessage);
      return null;
    }
  }
}

export default new GoogleIndexingService();
