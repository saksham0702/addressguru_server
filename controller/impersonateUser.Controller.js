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

    // ✅ Create isolated 10-minute impersonation token for the target user
    const impersonationToken = createJwtToken(
      {
        ...targetUser.toObject(),
        _id: targetUser._id,
        id: targetUser._id,
        roles: Array.isArray(targetUser.roles) && targetUser.roles.length > 0 ? targetUser.roles : [5],
        role: targetUser.roles?.[0] || 5,
        refId: targetUser.refId,
        email: targetUser.email,
        name: targetUser.name,
        phone: targetUser.phone,
        country_code: targetUser.country_code,
        avatar: targetUser.avatar,
        impersonated: true,
        masterAdminId: adminUser._id,
      },
      "10m"
    );

    // Update target user active state
    targetUser.lastSeen = new Date();
    targetUser.isOnline = true;
    await targetUser.save();

    // Set user authToken cookie for 10 minutes
    res.cookie("authToken", impersonationToken, COOKIE_OPTIONS(10 * 60 * 1000));
    if (adminBackupToken) {
      res.cookie("adminBackupToken", adminBackupToken, COOKIE_OPTIONS(24 * 60 * 60 * 1000));
    }

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
        phone: targetUser.phone,
        country_code: targetUser.country_code,
        avatar: targetUser.avatar,
        roles: targetUser.roles,
        role: targetUser.roles?.[0] || 5,
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
    const backupToken =
      req.cookies?.adminBackupToken ||
      req.headers["x-admin-backup-token"] ||
      req.body?.adminBackupToken;

    // Clear user impersonation cookie
    res.clearCookie("authToken");
    res.clearCookie("adminBackupToken");

    if (backupToken) {
      try {
        const decoded = JWT.verify(backupToken, SECRET_KEY);
        const admin = decoded?.user;
        const isAdmin = admin?.roles?.includes(ROLES.ADMIN) || admin?.role === ROLES.ADMIN;
        if (isAdmin) {
          res.cookie("authToken", backupToken, COOKIE_OPTIONS(24 * 60 * 60 * 1000));
          return successData(res, 200, true, "Impersonation ended. Admin session restored.", {
            authToken: backupToken,
          });
        }
      } catch (e) {
        console.warn("Backup token verify error on exit:", e?.message);
      }
    }

    return successData(res, 200, true, "Impersonation session ended.");
  } catch (error) {
    console.warn("Exit impersonation error:", error);
    return errorData(res, 500, false, error.message);
  }
};