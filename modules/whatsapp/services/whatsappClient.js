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
let reconnectTimer = null; // guard against stacking reconnect timers
let connectionTimeoutTimer = null;

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

  // If DB says "connected" but we have no live socket, correct the status
  // so the frontend always sees the real state (fixes stale-after-restart bug).
  let liveStatus = account.status;
  if (account.status === "connected" && (!sock || !sock.user)) {
    liveStatus = "disconnected";
    await WhatsappAccount.findByIdAndUpdate(account._id, {
      status: "disconnected",
    });
  }

  return {
    label: account.label,
    status: liveStatus,
    phoneNumber: account.phoneNumber,
    lastConnectedAt: account.lastConnectedAt,
    lastDisconnectedAt: account.lastDisconnectedAt,
  };
}

export async function getQr() {
  const account = await WhatsappAccount.findOne().select("+qr +authCreds");
  if (!account) return null;

  if (account.qr) {
    return account.qr;
  }

  // If disconnected or qr_pending without a live socket or QR, and not actively connecting, kickstart connection
  if (account.status !== "connected" && (!sock || !sock.user) && !isConnecting) {
    startConnection({ label: account.label, forceNew: !account.authCreds }).catch((err) =>
      console.error("[whatsapp] auto-start in getQr failed:", err.message),
    );
  }

  return null;
}

function closeCurrentSocket() {
  if (sock) {
    try {
      sock.ev.removeAllListeners();
      if (sock.ws) sock.ws.close();
      sock.end(undefined);
    } catch (e) {
      // ignore
    }
    sock = null;
  }
}

export async function startConnection(param) {
  let label = null;
  let forceNew = false;

  if (typeof param === "string") {
    label = param;
  } else if (param && typeof param === "object") {
    label = param.label;
    forceNew = Boolean(param.forceNew || param.force);
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const account = await getOrCreateAccount(label);

  // If already connected with an active socket and no forceNew requested, return status
  if (!forceNew && sock && sock.user) {
    return getStatus();
  }

  // If forceNew was explicitly requested or previous session was unlinked/disconnected,
  // clean up old credentials so Baileys generates a fresh QR code
  if (forceNew) {
    closeCurrentSocket();
    isConnecting = false;
    await WhatsappAccount.findByIdAndUpdate(account._id, {
      authCreds: null,
      authKeys: null,
      qr: null,
      phoneNumber: null,
      status: "disconnected",
    });
  }

  if (isConnecting && !forceNew) {
    return getStatus();
  }

  isConnecting = true;

  if (connectionTimeoutTimer) {
    clearTimeout(connectionTimeoutTimer);
  }
  // Safety watchdog: reset lock after 35 seconds if connection hangs
  connectionTimeoutTimer = setTimeout(() => {
    if (isConnecting && (!sock || !sock.user)) {
      console.warn("[whatsapp] Connection handshake timeout, releasing lock.");
      isConnecting = false;
    }
  }, 35000);

  try {
    const { state, saveCreds } = await useMongoAuthState(account._id);
    const { version } = await fetchLatestBaileysVersion();

    closeCurrentSocket();

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      printQRInTerminal: false,
      browser: ["AddressGuru Admin", "Chrome", "1.0.0"],
      connectTimeoutMs: 30000,
      defaultQueryTimeoutMs: 30000,
      keepAliveIntervalMs: 25000,
      retryRequestDelayMs: 2000,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, {
            margin: 2,
            scale: 6,
            color: {
              dark: "#1e293b",
              light: "#ffffff",
            },
          });
          await WhatsappAccount.findByIdAndUpdate(account._id, {
            status: "qr_pending",
            qr: qrDataUrl,
          });
          whatsappEventBus.emit(WHATSAPP_EVENTS.QR_UPDATED, { qr: qrDataUrl });
        } catch (err) {
          console.error("[whatsapp] QRCode generation error:", err.message);
        }
      }

      if (connection === "open") {
        isConnecting = false;
        if (connectionTimeoutTimer) clearTimeout(connectionTimeoutTimer);

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
        if (connectionTimeoutTimer) clearTimeout(connectionTimeoutTimer);
        sock = null;

        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        const badSession = statusCode === DisconnectReason.badSession;
        const isAuthFailure = loggedOut || badSession || statusCode === 401 || statusCode === 403 || statusCode === 405;

        await WhatsappAccount.findByIdAndUpdate(account._id, {
          status: loggedOut ? "logged_out" : "disconnected",
          lastDisconnectedAt: new Date(),
          disconnectReason: statusCode ? String(statusCode) : "unknown",
          ...(isAuthFailure ? { authCreds: null, authKeys: null, qr: null, phoneNumber: null } : {}),
        });

        whatsappEventBus.emit(WHATSAPP_EVENTS.DISCONNECTED, {
          loggedOut,
          statusCode,
        });

        if (!isAuthFailure) {
          // Automatic reconnect on transient drop if creds are intact
          if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null;
              startConnection({ label: account.label }).catch((err) =>
                console.error("[whatsapp] reconnect failed:", err.message),
              );
            }, 5000);
          }
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
  } catch (err) {
    isConnecting = false;
    if (connectionTimeoutTimer) clearTimeout(connectionTimeoutTimer);
    console.error("[whatsapp] startConnection initialization error:", err.message);
  }

  return getStatus();
}

export async function logout() {
  const account = await getOrCreateAccount();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (connectionTimeoutTimer) {
    clearTimeout(connectionTimeoutTimer);
    connectionTimeoutTimer = null;
  }
  isConnecting = false;

  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      // ignore
    }
    closeCurrentSocket();
  }

  await WhatsappAccount.findByIdAndUpdate(account._id, {
    status: "logged_out",
    authCreds: null,
    authKeys: null,
    qr: null,
    phoneNumber: null,
  });

  return getStatus();
}

export function getSocket() {
  if (!sock || !sock.user) throw new Error("WhatsApp is not connected");
  return sock;
}

export function getSocketOrNull() {
  return sock || null;
}

/**
 * Call once on server boot, AFTER the DB is connected.
 * - Resets any stale "connected" status (server restarted, socket is gone).
 * - Restores the Baileys session only if auth creds exist in the DB.
 */
export async function restoreSessionOnBoot() {
  try {
    const account = await WhatsappAccount.findOne().select("+authCreds");
    if (!account) return;

    if (
      account.status === "connected" ||
      account.status === "connecting" ||
      account.status === "qr_pending"
    ) {
      await WhatsappAccount.findByIdAndUpdate(account._id, {
        status: "disconnected",
        qr: null,
      });
    }

    if (account.authCreds) {
      console.log("[whatsapp] Restoring session from DB...");
      await startConnection({ label: account.label });
    } else {
      console.log("[whatsapp] No saved session found, waiting for manual connect.");
    }
  } catch (err) {
    console.error("[whatsapp] restoreSessionOnBoot failed:", err.message);
  }
}

