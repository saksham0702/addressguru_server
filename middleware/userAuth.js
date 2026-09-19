import jwt from "jsonwebtoken";
import { SECRET_KEY } from "../services/constant.js";
import { errorData } from "../services/helper.js";

// ─── Helper: extract token from cookie or Authorization header ────────────────
const extractToken = (req) => {
  // 1. Cookie (web clients)
  if (req?.cookies?.authToken) return req?.cookies?.authToken;

  // 2. Bearer token (mobile / Postman / API clients)
  const authHeader = req?.headers?.authorization;
  if (authHeader && authHeader?.startsWith("Bearer ")) {
    return authHeader?.split(" ")[1];
  }

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

    // ── Inactivity check: enforce 60-minute idle timeout ─────────────────────
    // Import lazily to avoid circular dep issues at module load time.
    const { default: User } = await import("../model/userSchema.js");
    const userId = req.user?.id || req.user?._id;

    if (userId) {
      const dbUser = await User.findById(userId).select("lastSeen isOnline").lean();

      if (dbUser) {
        const INACTIVITY_MS = 60 * 60 * 1000; // 60 minutes
        const now = new Date();
        const lastSeen = dbUser.lastSeen ? new Date(dbUser.lastSeen) : null;
        const isInactive = lastSeen && (now - lastSeen) > INACTIVITY_MS;

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
