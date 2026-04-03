// controllers/impersonateUser.js
import User from "../model/userSchema.js";
import JWT from "jsonwebtoken";
import { SECRET_KEY, ROLES } from "../services/constant.js";
import createJwtToken from "../utils/generateToken.js";
import { errorData, successData } from "../services/helper.js";

// ─── Helper: extract token from cookie or Authorization header ────────────────
const extractToken = (req) => {
  if (req?.cookies?.authToken) return req?.cookies?.authToken;
  const authHeader = req?.headers?.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.split(" ")[1];
  return null;
};

const COOKIE_OPTIONS = (maxAge) => ({
  httpOnly: true,
  maxAge,
});

// ─── POST /api/user-login/:userId ─────────────────────────────────────────────
export const impersonateUser = async (req, res) => {
    console.log("IMPERSONATE USER");
    console.log("IMPERSONATE USER req.user", req.user);
    console.log("IMPERSONATE USER req.params", req.params);
  try {
    const admin = req.user; // set by authenticate middleware
      
    const adminRole = await User.findOne({ _id: admin.id, deletedAt: null });
    console.log("adminRole", adminRole);
    // ✅ Only master admin allowed
    if (!adminRole?.roles?.includes(1)) {
      return errorData(res, 403, false, "Access denied. Admins only.");
    }

    // ✅ Find target user
    const user = await User.findOne({ _id: req.params.userId, deletedAt: null });
    console.log("USER", user);
    if (!user) {
      return errorData(res, 404, false, "User not found.");
    }

    // ✅ Prevent impersonating another master admin
    if (user.roles?.includes(ROLES.MASTER_ADMIN)) {
      return errorData(res, 403, false, "Cannot impersonate another admin.");
    }

    // ✅ Backup current admin token before overwriting
    const adminBackupToken = extractToken(req);

    // ✅ Create short-lived impersonation token (5 min)
    const impersonationToken = createJwtToken(
      {
        _id: user._id,
        roles: user.roles,
        refId: user.refId,
        impersonated: true,
        masterAdminId: admin.id,
      },
      "5m"
    );

    // ✅ Set impersonation token in cookie
    res.cookie("authToken", impersonationToken, COOKIE_OPTIONS(5 * 60 * 1000));

    // ✅ Backup admin token in separate cookie (for cookie-based clients)
    res.cookie("adminBackupToken", adminBackupToken, COOKIE_OPTIONS(5 * 60 * 1000));

    return successData(res, 200, true, "Impersonation started", {
      authToken: impersonationToken,  // for Bearer clients to switch token
      adminBackupToken,               // for Bearer clients to store and use on exit
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
    });
  } catch (error) {
    console.warn("Impersonation error:", error);
    return errorData(res, 500, false, error.message);
  }
};

// ─── POST /api/impersonate/exit ───────────────────────────────────────────────
export const exitImpersonation = async (req, res) => {
  try {
    // ✅ Get backup token — cookie (web) or header (Bearer/mobile)
    const backupToken =
      req.cookies?.adminBackupToken ||
      req.headers["x-admin-backup-token"];

    if (!backupToken) {
      return errorData(res, 400, false, "No active impersonation session.");
    }

    // ✅ Verify it's a valid admin token
    const decoded = JWT.verify(backupToken, SECRET_KEY);
    const admin = decoded?.user;

    if (!admin?.roles?.includes(ROLES.MASTER_ADMIN)) {
      return errorData(res, 403, false, "Invalid admin backup token.");
    }

    // ✅ Restore admin token in cookie
    res.cookie("authToken", backupToken, COOKIE_OPTIONS(24 * 60 * 60 * 1000));

    // ✅ Clear backup cookie
    res.clearCookie("adminBackupToken");

    return successData(res, 200, true, "Impersonation ended. Redirecting to admin panel.", {
      authToken: backupToken, // Bearer clients restore this
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return errorData(res, 401, false, "Admin session expired. Please login again.");
    }
    console.warn("Exit impersonation error:", error);
    return errorData(res, 500, false, error.message);
  }
};