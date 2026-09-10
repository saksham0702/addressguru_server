export function normalizeToE164(countryCode, mobileNumber) {
  if (!mobileNumber) return null;
  let cc = (countryCode || "").toString().replace(/\D/g, "");
  let num = mobileNumber.toString().replace(/\D/g, "");
  if (!num) return null;

  // Handle leading 00 (e.g. 00971501234567)
  if (num.startsWith("00")) {
    num = num.replace(/^00+/, "");
  }

  // If number starts with cc already (e.g. 971501234567)
  if (cc && num.startsWith(cc)) {
    return num;
  }

  // Strip leading zero from local numbers (e.g. 0501234567 -> 501234567)
  const stripped = num.replace(/^0+/, "");

  if (cc) {
    if (stripped.startsWith(cc)) return stripped;
    return `${cc}${stripped}`;
  }

  // If no cc provided, check if stripped already has UAE/international format
  if (stripped.startsWith("971")) return stripped;
  if (stripped.length === 9) return `971${stripped}`;

  return stripped;
}

export function isLidJid(jid) {
  if (!jid) return false;
  return jid.endsWith("@lid") || jid.endsWith("@hosted.lid");
}

export function isPnJid(jid) {
  if (!jid) return false;
  return jid.endsWith("@s.whatsapp.net");
}

export function jidToPhone(jid) {
  if (!jid) return null;
  return jid.split("@")[0].split(":")[0];
}

export function phoneToJid(phone) {
  const clean = (phone || "").toString().replace(/\D/g, "");
  return clean ? `${clean}@s.whatsapp.net` : null;
}

/** Last N digits — used for tolerant matching across slightly different country-code formatting. */
export function tail(phone, n = 9) {
  const clean = (phone || "").toString().replace(/\D/g, "");
  return clean.slice(-n);
}

