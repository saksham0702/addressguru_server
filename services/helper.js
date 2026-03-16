import userLogSchema from "../model/userLogSchema.js";
import requestIp from "request-ip";
import { UAParser } from "ua-parser-js";

export const successData = (
  res,
  statusCode = 200,
  success = true,
  message = null,
  data = null
) => {
  return res.status(statusCode).json({
    status: success,
    message,
    data,
  });
};

export const errorData = (
  res,
  statusCode,
  error,
  message = null,
  data = null,
  errorMessage = null
) => {
  return res.status(statusCode).json({
    status: error,
    message,
    data,
    errorMessage,
  });
};

export const addFullImageUrl = (items, req) => {
  const baseUrl = `${req.protocol}://${req.get("host")}/`;
  return items.map((item) => {
    const obj = item.toObject();
    if (obj.image && !obj.image.startsWith("http")) {
      const cleanImagePath = obj.image.startsWith("public/")
        ? obj.image.substring("public/".length)
        : obj.image;

      obj.image = baseUrl + cleanImagePath;
    }
    return obj;
  });
};

export const getFullImageUrl = (imagePath, socket) => {
  if (!imagePath || imagePath.startsWith("http")) return imagePath;
  const protocol = socket.handshake.headers["x-forwarded-proto"] || "http";
  const host = socket.handshake.headers.host;
  const baseUrl = `${protocol}://${host}/`;

  const cleanPath = imagePath.startsWith("public/")
    ? imagePath.substring("public/".length)
    : imagePath;

  return baseUrl + cleanPath;
};

export const generateOTP = function () {
  var digits = "0123456789";
  let OTP = "";
  for (let i = 0; i < 6; i++) {
    OTP += digits[Math.floor(Math.random() * 10)];
  }
  return OTP;
};

const normalizeDateUTC = (date) => {
  // Normalize the date to midnight in UTC
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
};

export const addUserLog = async (user, req) => {
  // console.log("USERLOG :", user);
  // console.log("USERREQ :", req);
  // console.log("USERREQ IP :", req?.ip, "||", req.headers["x-forwarded-for"]);
  // console.log("USERREQ DEVICEE:", req.device?.type || "Desktop");
  // console.log("USERREQ OS NAME:", req.device?.os?.name);
  // console.log("USERREQ BROWSER:", req.device?.browser?.name);
  // console.log("USERREQ B VERSION:", req.device?.browser?.version);
  // console.log("USERREQ :", req.headers["user-agent"]);
  // console.log("USERREQ :", req.headers["x-isp"] || "Unknown");

  try {
    const ipAddress =
      req?.headers?.["x-forwarded-for"]?.split(",")[0] ||
      req?.connection?.remoteAddress ||
      requestIp.getClientIp(req) ||
      "Unknown";

    const uaParser = new UAParser(req?.headers?.["user-agent"]);
    const ua = uaParser.getResult();

    await userLogSchema.create({
      userId: user._id,
      ipAddress,
      device_type: ua.device.type || "Desktop",
      device_os: ua.os.name || "Unknown OS",
      device_browser: ua.browser.name || "Unknown Browser",
      device_browserVersion: ua.browser.version || "Unknown",
      device_userAgent: req?.headers?.["user-agent"],
      network_proxy: req?.headers?.["via"] ? true : false,
      session_loginAt: new Date(),
      session_lastActiveAt: new Date(),
      type: "login",
    });

    console.log(`📝 User log added for ${user.email} from ${ipAddress}`);
  } catch (error) {
    console.error("⚠️ Failed to add user log:", error.message);
  }
};

export const normalizeRole = (role) => {
  if (role === undefined || role === null) return undefined;
  // preserve if already string
  if (typeof role === "string") return role;
  // convert numbers to string
  if (typeof role === "number") return String(role);
  // fallback
  return String(role);
};


export const parseSearchQuery = (query) => {
  const regex = /(.*?)\s+(?:in|near|at)\s+(.*)/i;
  const match = query.match(regex);

  if (match) {
    return {
      keyword: match[1].trim(),
      location: match[2].trim(),
    };
  }

  return {
    keyword: query.trim(),
    location: "",
  };
};