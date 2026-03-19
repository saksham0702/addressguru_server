import jwt from "jsonwebtoken";
import { SECRET_KEY } from "../services/constant.js";
import { errorData } from "../services/helper.js";

// ─── Helper: extract token from cookie or Authorization header ────────────────
const extractToken = (req) => {
  // 1. Cookie (web clients)
  if (req.cookies?.authToken) return req.cookies.authToken;

  // 2. Bearer token (mobile / Postman / API clients)
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return null;
};

// ─── authenticate — required auth, blocks if no valid token ──────────────────
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return errorData(res, 401, false, "Unauthorized: No token provided");
    }

    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded?.user;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return errorData(res, 401, false, "Session expired. Please login again.");
    }
    console.error("Authentication error:", error);
    return errorData(res, 401, false, "Invalid authentication token");
  }
};

// ─── optionalAuth — soft auth, sets req.user = null if no/invalid token ───────
const optionalAuth = (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      const decoded = jwt.verify(token, SECRET_KEY);
      req.user = decoded?.user;
    } else {
      req.user = null;
    }
  } catch {
    req.user = null; // expired or invalid token — treat as guest
  }
  next();
};

export { authenticate, optionalAuth };
