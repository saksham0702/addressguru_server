import { downloadMediaMessage } from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import { getSocket, getSocketOrNull } from "./whatsappClient.js";
import WhatsappChat from "../whatsappChat.model.js";
import WhatsappMessage from "../whatsappMessage.model.js";
import WhatsappAccount from "../whatsappAccount.model.js";
import { getOrCreateChat } from "./whatsappChat.js";
import {
  normalizeToE164,
  phoneToJid,
  jidToPhone,
  isLidJid,
  isPnJid,
  tail,
} from "../phoneUtils.js";
import { identifyByPhone } from "./whatsappIdentity.js";
import { whatsappEventBus, WHATSAPP_EVENTS } from "../whatsappEvents.js";

const ACCOUNT_LABEL = process.env.WHATSAPP_ACCOUNT_LABEL || "default";

// ─────────────────────────────────────────────────────────────────────────
// SENDING
// ─────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} params
 * @param {string} params.to - raw recipient number as provided by the caller
 * @param {string} params.text - message body
 * @param {string} [params.countryCode] - optional, combined with `to` via normalizeToE164
 */
export async function sendTextMessage({ to, text, countryCode }) {
  const account = await WhatsappAccount.findOne({
    status: "connected",
  });
  if (!account) {
    throw new Error("WhatsApp is not connected");
  }

  const normalizedPhone = normalizeToE164(countryCode, to);
  if (!normalizedPhone) throw new Error("Invalid recipient phone number");
  const jid = phoneToJid(normalizedPhone);

  const sock = getSocket();
  let lid = null;
  if (sock?.signalRepository?.lidMapping) {
    try {
      const mappedLid = await sock.signalRepository.lidMapping.getLIDForPN(jid);
      if (mappedLid) lid = mappedLid.split(":")[0] + "@lid";
    } catch (e) {
      // ignore
    }
  }

  const identity = await identifyByPhone(normalizedPhone);
  const chat = await getOrCreateChat({
    accountId: account._id,
    jid,
    lid,
    phone: normalizedPhone,
    user: identity.user?._id,
  });


  let waMessage;

  try {
    const sock = getSocket();
    waMessage = await sock.sendMessage(jid, { text });

    const message = await WhatsappMessage.create({
      whatsappAccount: account._id,
      chat: chat._id,
      waMessageId: waMessage.key.id,
      direction: "outbound",
      senderPhone: account.phoneNumber,
      receiverPhone: normalizedPhone,
      messageType: "text",
      content: text,
      status: "sent",
      timestamp: new Date(),
      user: identity.user?._id || null,
      businessListing: identity.businessListing?._id || null,
      propertyListing: identity.propertyListing?._id || null,
      marketplaceListing: identity.marketplaceListing?._id || null,
      job: identity.job?._id || null,
    });

    await WhatsappChat.findByIdAndUpdate(chat._id, {
      lastMessageAt: new Date(),
      lastMessagePreview: text.slice(0, 100),
    });

    whatsappEventBus.emit(WHATSAPP_EVENTS.MESSAGE_SENT, {
      messageId: message._id,
      to: normalizedPhone,
      text,
    });

    return message;
  } catch (err) {
    const failedMessage = await WhatsappMessage.create({
      whatsappAccount: account._id,
      chat: chat._id,
      waMessageId: waMessage?.key?.id || `failed_${Date.now()}`,
      direction: "outbound",
      senderPhone: account.phoneNumber,
      receiverPhone: normalizedPhone,
      messageType: "text",
      content: text,
      status: "failed",
      failReason: err.message,
      timestamp: new Date(),
      user: identity.user?._id || null,
    });

    whatsappEventBus.emit(WHATSAPP_EVENTS.MESSAGE_FAILED, {
      messageId: failedMessage._id,
      to: normalizedPhone,
      error: err.message,
    });

    throw err;
  }
}

/**
 * Send image, document, video, or audio file via WhatsApp
 */
export async function sendMediaMessage({ to, text, countryCode, file, messageType }) {
  const account = await WhatsappAccount.findOne({
    status: "connected",
  });
  if (!account) {
    throw new Error("WhatsApp is not connected");
  }

  const normalizedPhone = normalizeToE164(countryCode, to);
  if (!normalizedPhone) throw new Error("Invalid recipient phone number");
  const jid = phoneToJid(normalizedPhone);

  const sock = getSocket();
  let lid = null;
  if (sock?.signalRepository?.lidMapping) {
    try {
      const mappedLid = await sock.signalRepository.lidMapping.getLIDForPN(jid);
      if (mappedLid) lid = mappedLid.split(":")[0] + "@lid";
    } catch (e) {
      // ignore
    }
  }

  const identity = await identifyByPhone(normalizedPhone);
  const chat = await getOrCreateChat({
    accountId: account._id,
    jid,
    lid,
    phone: normalizedPhone,
    user: identity.user?._id,
  });

  const filePath = file.path;
  const mimetype = file.mimetype || "application/octet-stream";
  const fileBuffer = fs.readFileSync(filePath);
  const relativeMediaUrl = "/" + path.relative(process.cwd(), filePath).replace(/\\/g, "/");

  let detectedType = messageType || "document";
  let waPayload = {};

  if (mimetype.startsWith("image/")) {
    detectedType = "image";
    waPayload = {
      image: fileBuffer,
      caption: text || undefined,
    };
  } else if (mimetype.startsWith("video/")) {
    detectedType = "video";
    waPayload = {
      video: fileBuffer,
      caption: text || undefined,
    };
  } else if (mimetype.startsWith("audio/")) {
    detectedType = "audio";
    waPayload = {
      audio: fileBuffer,
      mimetype: mimetype,
    };
  } else {
    detectedType = "document";
    waPayload = {
      document: fileBuffer,
      mimetype: mimetype,
      fileName: file.originalname,
      caption: text || undefined,
    };
  }

  let waMessage;

  try {
    const sock = getSocket();
    waMessage = await sock.sendMessage(jid, waPayload);

    const message = await WhatsappMessage.create({
      whatsappAccount: account._id,
      chat: chat._id,
      waMessageId: waMessage.key.id,
      direction: "outbound",
      senderPhone: account.phoneNumber || "business",
      receiverPhone: normalizedPhone,
      messageType: detectedType,
      content: text || file.originalname,
      mediaUrl: relativeMediaUrl,
      status: "sent",
      timestamp: new Date(),
      user: identity.user?._id || null,
      businessListing: identity.businessListing?._id || null,
      propertyListing: identity.propertyListing?._id || null,
      marketplaceListing: identity.marketplaceListing?._id || null,
      job: identity.job?._id || null,
    });

    await WhatsappChat.findByIdAndUpdate(chat._id, {
      lastMessageAt: new Date(),
      lastMessagePreview: text
        ? `[${detectedType}] ${text}`
        : `[${detectedType}] ${file.originalname}`,
    });

    whatsappEventBus.emit(WHATSAPP_EVENTS.MESSAGE_SENT, {
      messageId: message._id,
      to: normalizedPhone,
      text: text || file.originalname,
    });

    return message;
  } catch (err) {
    const failedMessage = await WhatsappMessage.create({
      whatsappAccount: account._id,
      chat: chat._id,
      waMessageId: waMessage?.key?.id || `failed_${Date.now()}`,
      direction: "outbound",
      senderPhone: account.phoneNumber || "business",
      receiverPhone: normalizedPhone,
      messageType: detectedType,
      content: text || file.originalname,
      mediaUrl: relativeMediaUrl,
      status: "failed",
      failReason: err.message,
      timestamp: new Date(),
      user: identity.user?._id || null,
    });

    whatsappEventBus.emit(WHATSAPP_EVENTS.MESSAGE_FAILED, {
      messageId: failedMessage._id,
      to: normalizedPhone,
      error: err.message,
    });

    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// RECEIVING
// ─────────────────────────────────────────────────────────────────────────

function extractMessageContent(msg) {
  const m = msg.message;
  if (!m) return { type: "unknown", content: null };

  if (m.conversation) return { type: "text", content: m.conversation };
  if (m.extendedTextMessage)
    return { type: "text", content: m.extendedTextMessage.text };
  if (m.imageMessage)
    return { type: "image", content: m.imageMessage.caption || null };
  if (m.videoMessage)
    return { type: "video", content: m.videoMessage.caption || null };
  if (m.audioMessage) return { type: "audio", content: null };
  if (m.documentMessage)
    return {
      type: "document",
      content: m.documentMessage.fileName || m.documentMessage.caption || "Document",
    };
  if (m.stickerMessage) return { type: "sticker", content: null };
  if (m.locationMessage) {
    return {
      type: "location",
      content: `${m.locationMessage.degreesLatitude},${m.locationMessage.degreesLongitude}`,
    };
  }
  if (m.contactMessage)
    return { type: "contact", content: m.contactMessage.displayName || null };

  return { type: "unknown", content: null };
}

function resolveTimestamp(msg) {
  const raw = msg.messageTimestamp;
  const seconds =
    typeof raw === "object" && raw !== null ? (raw.low ?? Number(raw)) : raw;
  return new Date((seconds || Date.now() / 1000) * 1000);
}

async function saveIncomingMedia(msg) {
  try {
    const m = msg.message;
    if (!m) return null;

    const isMedia =
      m.imageMessage ||
      m.documentMessage ||
      m.videoMessage ||
      m.audioMessage ||
      m.stickerMessage;

    if (!isMedia) return null;

    const buffer = await downloadMediaMessage(
      msg,
      "buffer",
      {},
      { logger: undefined, reuploadRequest: undefined }
    );

    if (!buffer) return null;

    let ext = "bin";
    if (m.imageMessage) ext = "jpg";
    else if (m.videoMessage) ext = "mp4";
    else if (m.audioMessage) ext = "mp3";
    else if (m.documentMessage) {
      ext =
        path
          .extname(m.documentMessage.fileName || "")
          .replace(".", "") || "pdf";
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString("default", { month: "long" });
    const day = String(now.getDate()).padStart(2, "0");

    const filename = `inbound-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
    const uploadDir = path.join(
      process.cwd(),
      "uploads",
      "whatsapp",
      `${year}`,
      `${month}`,
      `${day}`,
      "inbound",
    );
    fs.mkdirSync(uploadDir, { recursive: true });
    const fullFilePath = path.join(uploadDir, filename);
    fs.writeFileSync(fullFilePath, buffer);

    return "/" + path.relative(process.cwd(), fullFilePath).replace(/\\/g, "/");
  } catch (err) {
    console.error("[whatsapp] Error downloading incoming media:", err.message);
    return null;
  }
}

/** Wired to sock.ev.on("messages.upsert", ...) in whatsappClientService.js */
export async function handleIncomingMessage(payload, accountId) {
  const { messages, type } = payload;
  if (type !== "notify") return; // ignore history-sync batches, only handle live messages

  const account = await WhatsappAccount.findById(accountId);
  const sock = getSocketOrNull();

  for (const msg of messages) {
    if (!msg.message || msg.key.fromMe) continue; // skip empty payloads and our own echoes

    const rawJid = msg.key.remoteJid;
    if (!rawJid || rawJid.endsWith("@g.us") || rawJid === "status@broadcast") continue; // groups/status out of scope for now

    const existing = await WhatsappMessage.findOne({
      whatsappAccount: accountId,
      waMessageId: msg.key.id,
    });
    if (existing) continue; // de-dupe replays that can happen around reconnects

    const isLid = isLidJid(rawJid);
    let resolvedPhone = null;
    let resolvedPnJid = null;
    let resolvedLid = isLid ? rawJid : null;

    // 1. Check if Baileys envelope provided remoteJidAlt / participantAlt / participantPn
    const altJid = msg.key.remoteJidAlt || msg.key.participantAlt || msg.key.participant;
    if (altJid) {
      if (isPnJid(altJid)) {
        resolvedPnJid = altJid;
        resolvedPhone = jidToPhone(altJid);
      } else if (isLidJid(altJid)) {
        resolvedLid = altJid;
      }
    }

    // 2. If isLid and phone is still not resolved, query Baileys signalRepository LID mapping
    if (isLid && !resolvedPhone && sock?.signalRepository?.lidMapping) {
      try {
        const pnFromRepo = await sock.signalRepository.lidMapping.getPNForLID(rawJid);
        if (pnFromRepo) {
          resolvedPnJid = pnFromRepo.split(":")[0] + "@s.whatsapp.net";
          resolvedPhone = jidToPhone(pnFromRepo);
        }
      } catch (e) {
        // ignore
      }
    }

    // 3. Check existing chat by LID if it was previously linked to a phone
    if (isLid && !resolvedPhone) {
      const existingChat = await WhatsappChat.findOne({
        whatsappAccount: accountId,
        $or: [{ lid: rawJid }, { jid: rawJid }],
        phone: { $exists: true, $ne: null },
      });
      if (
        existingChat &&
        existingChat.phone &&
        !isLidJid(existingChat.phone) &&
        !isLidJid(existingChat.jid)
      ) {
        resolvedPhone = existingChat.phone;
        resolvedPnJid = existingChat.jid;
      }
    }

    const fallbackPhone = jidToPhone(rawJid);
    const finalPhone = resolvedPhone || fallbackPhone || "unknown";
    const finalJid =
      resolvedPnJid ||
      (!isLid ? rawJid : resolvedPhone ? phoneToJid(resolvedPhone) : rawJid);
    const finalLid = resolvedLid || (isLid ? rawJid : null);

    const { type: messageType, content } = extractMessageContent(msg);
    const mediaUrl = await saveIncomingMedia(msg);
    const pushName = msg.pushName || null;
    const identity = await identifyByPhone(finalPhone);

    const chat = await getOrCreateChat({
      accountId,
      jid: finalJid,
      lid: finalLid,
      phone: finalPhone,
      name: pushName,
      user: identity.user?._id,
    });

    const savedMessage = await WhatsappMessage.create({
      whatsappAccount: accountId,
      chat: chat._id,
      waMessageId: msg.key.id,
      direction: "inbound",
      senderPhone: finalPhone,
      receiverPhone: account?.phoneNumber || "business",
      messageType,
      content,
      mediaUrl,
      status: "delivered",
      timestamp: resolveTimestamp(msg),
      user: identity.user?._id || null,
      businessListing: identity.businessListing?._id || null,
      propertyListing: identity.propertyListing?._id || null,
      marketplaceListing: identity.marketplaceListing?._id || null,
      job: identity.job?._id || null,
    });

    await WhatsappChat.findByIdAndUpdate(chat._id, {
      lastMessageAt: savedMessage.timestamp,
      lastMessagePreview: (content || `[${messageType}]`).slice(0, 100),
      $inc: { unreadCount: 1 },
      ...(pushName && !chat.name ? { name: pushName } : {}),
      ...(finalLid && !chat.lid ? { lid: finalLid } : {}),
    });

    whatsappEventBus.emit(WHATSAPP_EVENTS.MESSAGE_RECEIVED, {
      messageId: savedMessage._id,
      chatId: chat._id,
      from: finalPhone,
      senderName: pushName || chat.name,
      messageType,
      content,
      mediaUrl,
      identity: {
        userId: identity.user?._id || null,
        businessListingId: identity.businessListing?._id || null,
        propertyListingId: identity.propertyListing?._id || null,
        marketplaceListingId: identity.marketplaceListing?._id || null,
        jobId: identity.job?._id || null,
      },
    });
  }
}


