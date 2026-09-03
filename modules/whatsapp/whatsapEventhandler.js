// modules/whatsapp/events/whatsappEventHandlers.js
import { whatsappEventBus, APP_EVENTS } from "./whatsappEvents.js";
import { sendTextMessage } from "./services/whatsappMessage.js";

/**
 * Registers listeners for business events emitted by your existing modules.
 * Import this file once (see index.js) so the listeners are attached on boot.
 *
 * Existing modules should emit like:
 *   whatsappEventBus.emit(APP_EVENTS.LISTING_APPROVED, { phone, countryCode, listingTitle });
 *
 * Adjust payload shape / message copy to match your actual event producers.
 */

whatsappEventBus.on(APP_EVENTS.LISTING_APPROVED, async (payload = {}) => {
  try {
    const { phone, countryCode, listingTitle } = payload;
    if (!phone) return;
    await sendTextMessage({
      to: phone,
      countryCode,
      text: `Good news! Your listing "${listingTitle}" has been approved and is now live.`,
    });
  } catch (err) {
    console.error("[whatsapp] LISTING_APPROVED handler failed:", err.message);
  }
});

whatsappEventBus.on(APP_EVENTS.LISTING_REJECTED, async (payload = {}) => {
  try {
    const { phone, countryCode, listingTitle, reason } = payload;
    if (!phone) return;
    await sendTextMessage({
      to: phone,
      countryCode,
      text: `Your listing "${listingTitle}" was rejected.${reason ? ` Reason: ${reason}` : ""}`,
    });
  } catch (err) {
    console.error("[whatsapp] LISTING_REJECTED handler failed:", err.message);
  }
});

whatsappEventBus.on(
  APP_EVENTS.LISTING_ENQUIRY_RECEIVED,
  async (payload = {}) => {
    try {
      const { phone, countryCode, listingTitle, enquirerName } = payload;
      if (!phone) return;
      await sendTextMessage({
        to: phone,
        countryCode,
        text: `New enquiry from ${enquirerName || "a user"} about "${listingTitle}".`,
      });
    } catch (err) {
      console.error(
        "[whatsapp] LISTING_ENQUIRY_RECEIVED handler failed:",
        err.message,
      );
    }
  },
);

whatsappEventBus.on(APP_EVENTS.FOLLOWUP_DUE, async (payload = {}) => {
  try {
    const { phone, countryCode, message } = payload;
    if (!phone) return;
    await sendTextMessage({
      to: phone,
      countryCode,
      text: message || "Just following up on your request.",
    });
  } catch (err) {
    console.error("[whatsapp] FOLLOWUP_DUE handler failed:", err.message);
  }
});

whatsappEventBus.on(APP_EVENTS.JOB_STATUS_CHANGED, async (payload = {}) => {
  try {
    const { phone, countryCode, jobTitle, status } = payload;
    if (!phone) return;
    await sendTextMessage({
      to: phone,
      countryCode,
      text: `Your job post "${jobTitle}" status changed to: ${status}.`,
    });
  } catch (err) {
    console.error("[whatsapp] JOB_STATUS_CHANGED handler failed:", err.message);
  }
});
