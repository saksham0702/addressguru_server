// modules/whatsapp/services/whatsappAuthStore.js
import { initAuthCreds, BufferJSON, proto } from "@whiskeysockets/baileys";
import WhatsappAccount from "../whatsappAccount.model.js";

/**
 * Mongo-backed replacement for Baileys' filesystem-based `useMultiFileAuthState`.
 * Keeps creds + signal keys inside the WhatsappAccount document (select:false fields),
 * so the session survives server restarts without ever touching disk or the frontend.
 */
export async function useMongoAuthState(accountId) {
  const account = await WhatsappAccount.findById(accountId).select(
    "+authCreds +authKeys",
  );

  const creds = account?.authCreds
    ? JSON.parse(account.authCreds, BufferJSON.reviver)
    : initAuthCreds();

  const keys = account?.authKeys
    ? JSON.parse(account.authKeys, BufferJSON.reviver)
    : {};

  const persist = async () => {
    await WhatsappAccount.findByIdAndUpdate(accountId, {
      authCreds: JSON.stringify(creds, BufferJSON.replacer),
      authKeys: JSON.stringify(keys, BufferJSON.replacer),
    });
  };

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            let value = keys[type]?.[id];
            if (value && type === "app-state-sync-key") {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            if (value) data[id] = value;
          }
          return data;
        },
        set: async (data) => {
          for (const category of Object.keys(data)) {
            keys[category] = keys[category] || {};
            Object.assign(keys[category], data[category]);
          }
          await persist();
        },
      },
    },
    saveCreds: persist,
  };
}
