import axios from "axios";
import WhatsappConfig from "../whatsappConfig.model.js";

/**
 * Normalizes phone number into E.164 digits without "+" for Meta Graph API
 * e.g. "+971 50 123 4567" -> "971501234567"
 */
export function formatToMetaRecipientNumber(countryCode = "+971", phone = "") {
  if (!phone) return "";
  const rawDigits = String(phone).replace(/[^\d]/g, "");
  let cDigits = String(countryCode).replace(/[^\d]/g, "");
  if (!cDigits) cDigits = "971";

  // If already starts with country code, keep as is
  if (rawDigits.startsWith(cDigits)) {
    return rawDigits;
  }
  // Strip leading zero if UAE/UK local format e.g. 0501234567
  const cleaned = rawDigits.startsWith("0") ? rawDigits.substring(1) : rawDigits;
  return `${cDigits}${cleaned}`;
}

/**
 * Fetch Official WhatsApp Cloud API Configuration
 */
export async function getCloudApiConfig() {
  let config = await WhatsappConfig.findOne();
  if (!config) {
    config = await WhatsappConfig.create({
      provider: "baileys",
      cloudApi: {
        phoneNumberId: "",
        wabaId: "",
        accessToken: "",
        displayPhoneNumber: "",
        apiVersion: "v20.0",
        isConfigured: false,
      },
    });
  }
  return config;
}

/**
 * Update Official WhatsApp Cloud API Credentials
 */
export async function updateCloudApiConfig({
  phoneNumberId,
  wabaId,
  accessToken,
  displayPhoneNumber,
  apiVersion = "v20.0",
  defaultProvider,
}) {
  let config = await WhatsappConfig.findOne();
  if (!config) {
    config = new WhatsappConfig();
  }

  const pId = String(phoneNumberId || "").trim();
  const token = String(accessToken || "").trim();
  const wId = String(wabaId || "").trim();
  const phone = String(displayPhoneNumber || "").trim();
  const ver = String(apiVersion || "v20.0").trim();

  config.cloudApi = {
    phoneNumberId: pId,
    wabaId: wId,
    accessToken: token,
    displayPhoneNumber: phone,
    apiVersion: ver,
    isConfigured: Boolean(pId && token),
  };

  if (defaultProvider) {
    config.provider = defaultProvider;
  }

  await config.save();
  return config;
}

/**
 * Sends a message via Official WhatsApp Cloud API (Meta Graph API)
 */
export async function sendOfficialCloudMessage({
  to,
  countryCode = "+971",
  text,
  mediaUrl,
  messageType = "text",
}) {
  const config = await getCloudApiConfig();
  const { phoneNumberId, accessToken, apiVersion = "v20.0", isConfigured } =
    config.cloudApi || {};

  if (!isConfigured || !phoneNumberId || !accessToken) {
    throw new Error(
      "Official WhatsApp Cloud API is not configured. Please enter Phone Number ID and Access Token."
    );
  }

  const recipientNumber = formatToMetaRecipientNumber(countryCode, to);
  if (!recipientNumber || recipientNumber.length < 7) {
    throw new Error(`Invalid recipient phone number: ${to}`);
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  let payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipientNumber,
  };

  if (messageType === "image" && mediaUrl) {
    payload.type = "image";
    payload.image = {
      link: mediaUrl,
      caption: text || "",
    };
  } else if (
    (messageType === "document" || messageType === "pdf") &&
    mediaUrl
  ) {
    payload.type = "document";
    payload.document = {
      link: mediaUrl,
      caption: text || "",
    };
  } else {
    // Plain text with link preview
    payload.type = "text";
    payload.text = {
      preview_url: true,
      body: text || "",
    };
  }

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 25000,
    });

    const msgId =
      response.data?.messages?.[0]?.id || `meta_${Date.now()}`;

    return {
      success: true,
      waMessageId: msgId,
      provider: "cloud_api",
      data: response.data,
    };
  } catch (error) {
    const metaErr = error.response?.data?.error;
    let errMessage = "Meta Cloud API request failed";

    if (metaErr) {
      errMessage = `Meta API Error (${metaErr.code || "unknown"}): ${
        metaErr.message || metaErr.error_user_msg || JSON.stringify(metaErr)
      }`;
      if (metaErr.error_data?.details) {
        errMessage += ` - ${metaErr.error_data.details}`;
      }
    } else if (error.message) {
      errMessage = error.message;
    }

    console.error("[WhatsAppCloudApi] Send error:", errMessage);
    throw new Error(errMessage);
  }
}

/**
 * Test Connection & Credentials for Official Meta Cloud API
 */
export async function testOfficialCloudApi({
  phoneNumberId,
  accessToken,
  testPhoneNumber,
  countryCode = "+971",
  apiVersion = "v20.0",
}) {
  const pId = phoneNumberId?.trim();
  const token = accessToken?.trim();

  if (!pId || !token) {
    throw new Error("Phone Number ID and Access Token are required.");
  }

  if (!testPhoneNumber) {
    throw new Error("Please provide a test recipient phone number.");
  }

  const recipientNumber = formatToMetaRecipientNumber(
    countryCode,
    testPhoneNumber
  );
  const url = `https://graph.facebook.com/${apiVersion}/${pId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipientNumber,
    type: "text",
    text: {
      body: "✅ Official WhatsApp Cloud API Test Message from AddressGuru UAE.\nYour Meta Cloud API credentials are valid and active!",
    },
  };

  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    timeout: 20000,
  });

  return {
    success: true,
    messageId: response.data?.messages?.[0]?.id,
    data: response.data,
  };
}
