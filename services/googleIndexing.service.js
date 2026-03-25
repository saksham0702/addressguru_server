import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      const configDir = path.join(__dirname, '../config');
      const keyPath = path.join(configDir, 'service-account.json');
      
      let credentials = null;

      if (fs.existsSync(keyPath)) {
        const keyFileContent = fs.readFileSync(keyPath, 'utf8');
        credentials = JSON.parse(keyFileContent);
      } else if (process.env.GOOGLE_INDEXING_EMAIL && process.env.GOOGLE_INDEXING_PRIVATE_KEY) {
        credentials = {
          client_email: process.env.GOOGLE_INDEXING_EMAIL,
          private_key: process.env.GOOGLE_INDEXING_PRIVATE_KEY.replace(/\\n/g, '\n')
        };
      }

      if (credentials) {
        this.jwtClient = new google.auth.JWT(
          credentials.client_email,
          null,
          credentials.private_key,
          ['https://www.googleapis.com/auth/indexing'],
          null
        );
        this.isInitialized = true;
      } else {
        console.warn('[GoogleIndexingService] Credentials not found. Service will not be active.');
      }
    } catch (error) {
      console.error('[GoogleIndexingService] Error initializing service:', error);
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
      
      console.log(`[GoogleIndexingService] Success for ${url}:`, response.data);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      console.error(`[GoogleIndexingService] Error for ${url}:`, errorMessage);
      // We don't necessarily want to crash the whole request if indexing fails
      return null;
    }
  }
}

export default new GoogleIndexingService();
