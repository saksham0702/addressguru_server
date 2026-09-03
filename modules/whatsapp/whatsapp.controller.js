// modules/whatsapp/controllers/whatsappController.js
import * as clientService from "./services/whatsappClient.js";
import * as messageService from "./services/whatsappMessage.js";
import * as chatService from "./services/whatsappChat.js";

// NOTE: the res.status(...).json({ success, ... }) shape below is a generic default.
// Swap it for your project's existing response helper/format (e.g. sendResponse(res, ...)
// or your ApiError/ApiResponse classes) to stay consistent with the rest of your API.

export async function getStatus(req, res) {
  try {
    const status = await clientService.getStatus();
    return res.status(200).json({ success: true, data: status });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getQr(req, res) {
  try {
    const qr = await clientService.getQr();
    return res.status(200).json({ success: true, data: { qr } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function connect(req, res) {
  try {
    const { label } = req.body || {};
    const status = await clientService.startConnection(label);
    return res.status(200).json({ success: true, data: status });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function disconnect(req, res) {
  try {
    const status = await clientService.logout();
    return res.status(200).json({ success: true, data: status });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function sendMessage(req, res) {
  try {
    const { to, text, countryCode } = req.body;
    if (!to || !text) {
      return res
        .status(400)
        .json({ success: false, message: "'to' and 'text' are required" });
    }
    const message = await messageService.sendTextMessage({
      to,
      text,
      countryCode,
    });
    return res.status(200).json({ success: true, data: message });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function sendMedia(req, res) {
  try {
    const { to, text, countryCode, messageType } = req.body;
    const file = req.file;
    if (!to || !file) {
      return res
        .status(400)
        .json({ success: false, message: "'to' and a file are required" });
    }
    const message = await messageService.sendMediaMessage({
      to,
      text,
      countryCode,
      file,
      messageType,
    });
    return res.status(200).json({ success: true, data: message });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getChats(req, res) {
  try {
    const { page, limit } = req.query;
    const result = await chatService.listChats({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getChatMessages(req, res) {
  try {
    const { chatId } = req.params;
    const { page, limit } = req.query;
    const result = await chatService.listMessages(chatId, {
      page: Number(page) || 1,
      limit: Number(limit) || 100,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getConversation(req, res) {
  try {
    const { chatId, phone, countryCode, page, limit } = req.query;
    const result = await chatService.getConversation({
      chatId,
      phone,
      countryCode,
      page: Number(page) || 1,
      limit: Number(limit) || 100,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

