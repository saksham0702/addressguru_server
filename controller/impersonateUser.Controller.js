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
  try {
    const admin = req.user; // set by authenticate middleware
    if (!admin) {
      return errorData(res, 401, false, "Unauthorized. Please login as admin.");
    }

    const adminId = admin.id || admin._id;
    const adminUser = await User.findOne({ _id: adminId, deletedAt: null });

    // ✅ Only master admin (role 1) allowed
    if (!adminUser?.roles?.includes(ROLES.ADMIN) && !admin?.roles?.includes(ROLES.ADMIN)) {
      return errorData(res, 403, false, "Access denied. Admins only.");
    }

    // ✅ Find target user (works for Google users and email/password users)
    const targetUser = await User.findOne({ _id: req.params.userId, deletedAt: null });
    if (!targetUser) {
      return errorData(res, 404, false, "User not found.");
    }

    // ✅ Prevent impersonating another master admin
    if (targetUser.roles?.includes(ROLES.ADMIN)) {
      return errorData(res, 403, false, "Cannot impersonate another admin.");
    }

    // Backup current admin token from request
    const adminBackupToken = extractToken(req);

    // ✅ Create isolated 10-minute impersonation token
    const impersonationToken = createJwtToken(
      {
        _id: targetUser._id,
        roles: Array.isArray(targetUser.roles) && targetUser.roles.length > 0 ? targetUser.roles : [5],
        role: targetUser.roles?.[0] || 5,
        refId: targetUser.refId,
        email: targetUser.email,
        name: targetUser.name,
        impersonated: true,
        masterAdminId: adminUser._id,
      },
      "10m"
    );

    return successData(res, 200, true, "Impersonation session created successfully", {
      authToken: impersonationToken,
      adminBackupToken,
      expiresInSeconds: 600, // 10 minutes
      expiresAt: Date.now() + 10 * 60 * 1000,
      user: {
        _id: targetUser._id,
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        roles: targetUser.roles,
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