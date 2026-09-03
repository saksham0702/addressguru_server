// modules/whatsapp/services/whatsappChatService.js
import WhatsappChat from "../whatsappChat.model.js";
import WhatsappMessage from "../whatsappMessage.model.js";
import {
  normalizeToE164,
  tail,
  phoneToJid,
  isLidJid,
  isPnJid,
  jidToPhone,
} from "../phoneUtils.js";
import { getSocketOrNull } from "./whatsappClient.js";

/**
 * Merge any legacy or duplicate LID chats & orphan messages into the primary chat.
 */
export async function mergeDuplicateLidChats(primaryChat) {
  if (!primaryChat || !primaryChat._id) return primaryChat;

  const sock = getSocketOrNull();
  let updatedLid = primaryChat.lid;

  // If chat doesn't have an LID yet, check if Baileys' lidMapping has it
  if (!updatedLid && primaryChat.phone && sock?.signalRepository?.lidMapping) {
    try {
      const pnJid = primaryChat.jid && isPnJid(primaryChat.jid)
        ? primaryChat.jid
        : phoneToJid(primaryChat.phone);
      if (pnJid) {
        const mappedLid = await sock.signalRepository.lidMapping.getLIDForPN(pnJid);
        if (mappedLid) {
          updatedLid = mappedLid.split(":")[0] + "@lid";
          primaryChat.lid = updatedLid;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  const digitsOnly = primaryChat.phone ? primaryChat.phone.toString().replace(/\D/g, "") : "";
  const last9 = digitsOnly ? tail(digitsOnly, 9) : null;
  const lidPhone = updatedLid ? jidToPhone(updatedLid) : null;

  // Find any other chat records that represent the same contact
  const duplicateConditions = [];
  if (updatedLid) {
    duplicateConditions.push({ jid: updatedLid });
    duplicateConditions.push({ lid: updatedLid });
  }
  if (lidPhone) {
    duplicateConditions.push({ phone: lidPhone });
  }
  if (digitsOnly && isPnJid(primaryChat.jid)) {
    duplicateConditions.push({ phone: digitsOnly });
    if (last9) {
      duplicateConditions.push({ phone: new RegExp(`${last9}$`) });
    }
  }

  if (duplicateConditions.length > 0) {
    const duplicateChats = await WhatsappChat.find({
      _id: { $ne: primaryChat._id },
      $or: duplicateConditions,
    });

    for (const dup of duplicateChats) {
      // Transfer messages from duplicate chat to primary
      await WhatsappMessage.updateMany(
        { chat: dup._id },
        { $set: { chat: primaryChat._id } },
      );

      if (dup.name && !primaryChat.name) {
        primaryChat.name = dup.name;
      }
      if (dup.lid && !primaryChat.lid) {
        primaryChat.lid = dup.lid;
      } else if (!primaryChat.lid && isLidJid(dup.jid)) {
        primaryChat.lid = dup.jid;
      }
      if (dup.user && !primaryChat.user) {
        primaryChat.user = dup.user;
      }

      // Mark duplicate chat as deleted
      await WhatsappChat.findByIdAndUpdate(dup._id, { isDeleted: true });
    }
  }

  // Also heal any orphan messages matching this phone/LID
  const orphanConditions = [];
  if (digitsOnly && last9) {
    orphanConditions.push({ senderPhone: new RegExp(`${last9}$`) });
    orphanConditions.push({ receiverPhone: new RegExp(`${last9}$`) });
  }
  if (lidPhone) {
    orphanConditions.push({ senderPhone: lidPhone });
    orphanConditions.push({ receiverPhone: lidPhone });
  }

  if (orphanConditions.length > 0) {
    await WhatsappMessage.updateMany(
      {
        chat: { $ne: primaryChat._id },
        $or: orphanConditions,
      },
      { $set: { chat: primaryChat._id } },
    );
  }

  await primaryChat.save();
  return primaryChat;
}

export async function getOrCreateChat({
  accountId,
  jid,
  lid = null,
  phone,
  name,
  user,
}) {
  const isLid = isLidJid(jid);
  const digitsOnly = phone ? phone.toString().replace(/\D/g, "") : "";
  const last9 = digitsOnly ? tail(digitsOnly, 9) : null;
  const targetLid = lid || (isLid ? jid : null);

  // Search existing chat
  const lookupOr = [];
  if (jid) lookupOr.push({ jid });
  if (targetLid) {
    lookupOr.push({ lid: targetLid });
    lookupOr.push({ jid: targetLid });
  }
  if (digitsOnly && !isLid) {
    lookupOr.push({ phone: digitsOnly });
    if (last9) lookupOr.push({ phone: new RegExp(`${last9}$`) });
  }

  let chat = null;
  if (lookupOr.length > 0) {
    chat = await WhatsappChat.findOne({
      whatsappAccount: accountId,
      isDeleted: { $ne: true },
      $or: lookupOr,
    });
  }

  if (!chat) {
    chat = await WhatsappChat.create({
      whatsappAccount: accountId,
      jid,
      lid: targetLid,
      phone: digitsOnly || jidToPhone(jid) || "unknown",
      name: name || null,
      user: user || null,
    });
  } else {
    let changed = false;
    if (name && !chat.name) {
      chat.name = name;
      changed = true;
    }
    if (user && !chat.user) {
      chat.user = user;
      changed = true;
    }
    if (targetLid && !chat.lid) {
      chat.lid = targetLid;
      changed = true;
    }
    // If chat was previously created with LID as JID, upgrade to standard PN JID if available
    if (isPnJid(jid) && isLidJid(chat.jid)) {
      chat.jid = jid;
      if (digitsOnly) chat.phone = digitsOnly;
      changed = true;
    }
    if (changed) await chat.save();
  }

  // Merge any duplicates in background
  try {
    await mergeDuplicateLidChats(chat);
  } catch (e) {
    // ignore
  }

  return chat;
}

export async function findChatByPhone({ phone, countryCode }) {
  if (!phone) return null;
  const digitsOnly = phone.toString().replace(/\D/g, "");
  const normalized = normalizeToE164(countryCode, phone);
  const last9 = tail(phone, 9);
  const jid = normalized ? phoneToJid(normalized) : phoneToJid(digitsOnly);

  const orConditions = [
    { phone: digitsOnly },
    ...(normalized && normalized !== digitsOnly ? [{ phone: normalized }] : []),
    ...(jid ? [{ jid }] : []),
    ...(last9 ? [{ phone: new RegExp(`${last9}$`) }] : []),
  ];

  let chat = await WhatsappChat.findOne({
    isDeleted: { $ne: true },
    $or: orConditions,
  })
    .sort({ lastMessageAt: -1 })
    .populate("user", "name email");

  if (!chat && last9) {
    const orphanMsg = await WhatsappMessage.findOne({
      $or: [
        { receiverPhone: new RegExp(`${last9}$`) },
        { senderPhone: new RegExp(`${last9}$`) },
      ],
    }).sort({ timestamp: -1 });

    if (orphanMsg && orphanMsg.chat) {
      chat = await WhatsappChat.findById(orphanMsg.chat).populate(
        "user",
        "name email",
      );
    }
  }

  if (chat) {
    try {
      await mergeDuplicateLidChats(chat);
    } catch (e) {
      // ignore
    }
  }

  return chat;
}

export async function listChats({ page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [chats, total] = await Promise.all([
    WhatsappChat.find({ isDeleted: { $ne: true } })
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name email"),
    WhatsappChat.countDocuments({ isDeleted: { $ne: true } }),
  ]);
  return { chats, total, page, limit };
}

export async function listMessages(chatId, { page = 1, limit = 100 } = {}) {
  const skip = (page - 1) * limit;
  const [messages, total] = await Promise.all([
    WhatsappMessage.find({ chat: chatId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    WhatsappMessage.countDocuments({ chat: chatId }),
  ]);
  return { messages: messages.reverse(), total, page, limit };
}

export async function getConversation({
  chatId,
  phone,
  countryCode,
  page = 1,
  limit = 100,
} = {}) {
  let chat = null;

  if (chatId) {
    chat = await WhatsappChat.findById(chatId).populate("user", "name email");
  }

  if (!chat && phone) {
    chat = await findChatByPhone({ phone, countryCode });
  }

  if (chat) {
    try {
      await mergeDuplicateLidChats(chat);
      // Reset unread count when opening conversation
      if (chat.unreadCount > 0) {
        chat.unreadCount = 0;
        await WhatsappChat.findByIdAndUpdate(chat._id, { unreadCount: 0 });
      }
    } catch (e) {
      // ignore
    }
  }

  if (!chat) {
    return { chat: null, messages: [], total: 0, page, limit };
  }

  const { messages, total } = await listMessages(chat._id, { page, limit });
  return { chat, messages, total, page, limit };
}


