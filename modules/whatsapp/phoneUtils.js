export function normalizeToE164(countryCode, mobileNumber) {
  if (!mobileNumber) return null;
  const cc = (countryCode || "").toString().replace(/\D/g, "");
  const num = mobileNumber.toString().replace(/\D/g, "");
  if (!num) return null;
  if (cc && num.startsWith(cc)) return num;
  return `${cc}${num}`;
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

