// modules/whatsapp/events/whatsappEvents.js
import { EventEmitter } from "events";

/**
 * If your project already has a shared/global event bus, import and reuse that
 * one instead of this one, and just emit/listen on the event names below.
 */
export const whatsappEventBus = new EventEmitter();
whatsappEventBus.setMaxListeners(50);

// Emitted BY the WhatsApp module.
export const WHATSAPP_EVENTS = {
  CONNECTED: "WHATSAPP_CONNECTED",
  DISCONNECTED: "WHATSAPP_DISCONNECTED",
  QR_UPDATED: "WHATSAPP_QR_UPDATED",
  MESSAGE_RECEIVED: "WHATSAPP_MESSAGE_RECEIVED",
  MESSAGE_SENT: "WHATSAPP_MESSAGE_SENT",
  MESSAGE_FAILED: "WHATSAPP_MESSAGE_FAILED",
};

// Emitted BY your existing modules; the WhatsApp module listens to these (see whatsappEventHandlers.js).
export const APP_EVENTS = {
  LISTING_APPROVED: "LISTING_APPROVED",
  LISTING_REJECTED: "LISTING_REJECTED",
  LISTING_ENQUIRY_RECEIVED: "LISTING_ENQUIRY_RECEIVED",
  FOLLOWUP_DUE: "FOLLOWUP_DUE",
  JOB_STATUS_CHANGED: "JOB_STATUS_CHANGED",
};
