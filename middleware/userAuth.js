import jwt from "jsonwebtoken";
import { SECRET_KEY } from "../services/constant.js";
import { errorData } from "../services/helper.js";

// ─── Helper: extract token from Authorization header or cookie ────────────────
const extractToken = (req) => {
  // 1. Bearer token (explicit client header / API / per-tab session)
  const authHeader = req?.headers?.authorization;
  if (authHeader && authHeader?.startsWith("Bearer ")) {
    const rawToken = authHeader?.split(" ")[1]?.trim();
    if (rawToken && rawToken !== "null" && rawToken !== "undefined") {
      return rawToken;
    }
  }

  // 2. Cookie (web fallback)
  if (req?.cookies?.authToken) return req?.cookies?.authToken;

  return null;
};

// ─── authenticate — required auth, blocks if no valid token ──────────────────
export const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return errorData(res, 401, false, "Unauthorized: No token provided");
    }

    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded?.user;

    // Impersonated session: bypass inactivity check
    if (req.user?.impersonated) {
      return next();
    }

    // ── Inactivity check: enforce 60-minute idle timeout ─────────────────────
    // Import lazily to avoid circular dep issues at module load time.
    const { default: User } = await import("../model/userSchema.js");
    const userId = req.user?.id || req.user?._id;

    if (userId) {
      const dbUser = await User.findById(userId).select("lastSeen isOnline lastLoginAt").lean();

      if (dbUser) {
        const INACTIVITY_MS = 60 * 60 * 1000; // 60 minutes
        const now = new Date();

        // 1. Fresh session guard: if token was issued within the last 60 minutes (iat),
        // or user logged in within the last 60 minutes (lastLoginAt), this is an active session
        // and cannot be considered expired due to inactivity.
        const tokenIssuedAt = decoded?.iat ? new Date(decoded.iat * 1000) : null;
        const isFreshToken = tokenIssuedAt && (now.getTime() - tokenIssuedAt.getTime()) <= INACTIVITY_MS;

        const lastLoginAt = dbUser.lastLoginAt ? new Date(dbUser.lastLoginAt) : null;
        const isFreshLogin = lastLoginAt && (now.getTime() - lastLoginAt.getTime()) <= INACTIVITY_MS;

        if (isFreshToken || isFreshLogin) {
          // Keep user online and refresh lastSeen
          User.findByIdAndUpdate(userId, {
            lastSeen: now,
            isOnline: true,
          }).catch(() => {});
          return next();
        }

        // 2. Inactivity check: only enforce if the token is > 60m old AND lastSeen is > 60m old
        const lastSeen = dbUser.lastSeen ? new Date(dbUser.lastSeen) : null;
        const isInactive = lastSeen && (now.getTime() - lastSeen.getTime()) > INACTIVITY_MS;

        if (isInactive) {
          // Mark offline in background, then reject
          User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: lastSeen, // keep the actual last-seen time, don't overwrite
          }).catch(() => {});
          return errorData(res, 401, false, "Session expired due to inactivity. Please login again.");
        }

        // Active request — update lastSeen + isOnline in background (fire-and-forget)
        User.findByIdAndUpdate(userId, {
          lastSeen: now,
          isOnline: true,
        }).catch(() => {});
      }
    }

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return errorData(res, 401, false, "Session expired. Please login again.");
    }
    console.warn("Authentication error:", error);
    return errorData(res, 401, false, "Invalid authentication token");
  }
};

// ─── optionalAuth — soft auth, sets req.user = null if no/invalid token ───────
export const optionalAuth = (req, res, next) => {
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

// authorizeAdmin
export const authorizeAdmin = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return errorData(res, 401, false, "Unauthorized");
      }

      if (!allowedRoles.includes(user.role)) {
        return errorData(
          res,
          403,
          false,
          `Access denied for role: ${user.role}`,
        );
      }

      next();
    } catch (err) {
      console.warn("Authorization error:", err);
      return errorData(res, 500, false, "Authorization failed");
    }
  };
};
