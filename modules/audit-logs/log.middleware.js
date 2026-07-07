import { randomUUID } from "crypto";
import UAParser from "ua-parser-js";
import Log from "./log.model.js";

export default function logger(req, res, next) {
  const url = req.originalUrl || "";
  
  // Skip logging for health checks, debugging routes, static files, and logs endpoint itself
  if (
    url === "/" ||
    url === "/test-me" ||
    url === "/test-cookie" ||
    url.startsWith("/logs") ||
    url.startsWith("/uploads")
  ) {
    return next();
  }

  const start = Date.now();

  const requestId = randomUUID();

  req.requestId = requestId;

  const parser = new UAParser(req.headers["user-agent"]);

  const ua = parser.getResult();

  const oldJson = res.json;

  res.json = function (body) {
    Log.create({
      requestId,

      user: req.user?.id || req.user?._id || null,

      role: req.user?.role,

      module: req.baseUrl.replace("/", ""),

      action: req.method,

      method: req.method,

      endpoint: req.originalUrl,

      statusCode: res.statusCode,

      responseTime: Date.now() - start,

      ip:
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket.remoteAddress,

      browser: ua.browser.name,

      browserVersion: ua.browser.version,

      os: ua.os.name,

      osVersion: ua.os.version,

      device: ua.device.type || "Desktop",

      cpu: ua.cpu.architecture,

      userAgent: req.headers["user-agent"],

      query: req.query,

      params: req.params,

      body: req.body,

      response: body,
    }).catch(console.error);

    return oldJson.call(this, body);
  };

  next();
}
