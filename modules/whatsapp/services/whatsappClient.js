// modules/whatsapp/services/whatsappClientService.js
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import QRCode from "qrcode";

import WhatsappAccount from "../whatsappAccount.model.js";
import { useMongoAuthState } from "./whatsappAuthStore.js";
import { whatsappEventBus, WHATSAPP_EVENTS } from "../whatsappEvents.js";
import { handleIncomingMessage } from "./whatsappMessage.js";

const logger = pino({ level: process.env.WHATSAPP_LOG_LEVEL || "silent" });
const ACCOUNT_LABEL = process.env.WHATSAPP_ACCOUNT_LABEL || "default";

// Single in-memory socket instance for the whole process — never create a new
// Baileys connection per message/request. Every controller/service call below
// reuses this same socket.
let sock = null;
let isConnecting = false;

async function getOrCreateAccount(customLabel) {
  let account = await WhatsappAccount.findOne();
  if (!account) {
    account = await WhatsappAccount.create({
      label: customLabel || ACCOUNT_LABEL,
      status: "disconnected",
    });
  } else if (customLabel && account.label !== customLabel) {
    account.label = customLabel;
    await account.save();
  }
  return account;
}

export async function getStatus() {
  const account = await getOrCreateAccount();
  return {
    label: account.label,
    status: account.status,
    phoneNumber: account.phoneNumber,
    lastConnectedAt: account.lastConnectedAt,
    lastDisconnectedAt: account.lastDisconnectedAt,
  };
}

export async function getQr() {
  const account = await WhatsappAccount.findOne().select("+qr");
  return account?.qr || null;
}

export async function startConnection(label) {
  if (isConnecting || (sock && sock.user)) {
    if (label) {
      await getOrCreateAccount(label);
    }
    return getStatus();
  }
  isConnecting = true;

  const account = await getOrCreateAccount(label);
  const { state, saveCreds } = await useMongoAuthState(account._id);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    printQRInTerminal: false,
    browser: ["Business Backend", "Chrome", "1.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr);
      await WhatsappAccount.findByIdAndUpdate(account._id, {
        status: "qr_pending",
        qr: qrDataUrl,
      });
      whatsappEventBus.emit(WHATSAPP_EVENTS.QR_UPDATED, { qr: qrDataUrl });
    }

    if (connection === "open") {
      isConnecting = false;
      const phoneNumber = sock.user?.id?.split(":")[0] || null;
      await WhatsappAccount.findByIdAndUpdate(account._id, {
        status: "connected",
        phoneNumber,
        qr: null,
        lastConnectedAt: new Date(),
        disconnectReason: null,
      });
      whatsappEventBus.emit(WHATSAPP_EVENTS.CONNECTED, { phoneNumber });
    }

    if (connection === "close") {
      isConnecting = false;
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      await WhatsappAccount.findByIdAndUpdate(account._id, {
        status: loggedOut ? "logged_out" : "disconnected",
        lastDisconnectedAt: new Date(),
        disconnectReason: statusCode ? String(statusCode) : "unknown",
      });

      whatsappEventBus.emit(WHATSAPP_EVENTS.DISCONNECTED, {
        loggedOut,
        statusCode,
      });

      if (loggedOut) {
        // Invalid/logged-out session — clear stored creds so the next /connect
        // call produces a brand-new QR instead of retrying a dead session.
        await WhatsappAccount.findByIdAndUpdate(account._id, {
          authCreds: null,
          authKeys: null,
          qr: null,
        });
        sock = null;
      } else {
        // Any other disconnect (network blip, restart, etc.) — reconnect automatically.
        setTimeout(() => {
          startConnection().catch((err) =>
            console.error("[whatsapp] reconnect failed:", err.message),
          );
        }, 3000);
      }
    }
  });

  sock.ev.on("messages.upsert", async (payload) => {
    try {
      await handleIncomingMessage(payload, account._id);
    } catch (err) {
      console.error(
        "[whatsapp] failed to handle incoming message:",
        err.message,
      );
    }
  });

  return getStatus();
}

export async function logout() {
  const account = await getOrCreateAccount();
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      // ignore — state is cleared below regardless of whether the remote logout call succeeded
    }
  }
  await WhatsappAccount.findByIdAndUpdate(account._id, {
    status: "logged_out",
    authCreds: null,
    authKeys: null,
    qr: null,
    phoneNumber: null,
  });
  sock = null;
  return getStatus();
}

export function getSocket() {
  if (!sock || !sock.user) throw new Error("WhatsApp is not connected");
  return sock;
}

export function getSocketOrNull() {
  return sock || null;
}


/** Call once on server boot. Only reconnects if a previously-linked session exists. */
export async function restoreSessionOnBoot() {
  const account = await getOrCreateAccount();
  if (account.authCreds) {
    await startConnection();
  }
}
