/**
 * adminUserCrudController.js
 *
 * Full CRUD for admin-managed users.
 * Routes (all under /api/admin/users):
 *
 *   POST   /create           → create user
 *   GET    /                 → list all users (pagination + filters)
 *   GET    /:id              → get single user
 *   PATCH  /:id              → update user (name, email, phone, roles, city, status, password)
 *   DELETE /:id              → soft delete  (isDeleted=true)
 *   PATCH  /:id/restore      → restore soft-deleted user
 */

import bcrypt from "bcrypt";
import User from "../model/userSchema.js";
import { ROLE_NAMES, ROLES, VALID_ROLES } from "../services/constant.js";
import { errorData, successData } from "../services/helper.js";

const SALT_ROUNDS = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isStrongPassword = (pwd) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}[\]:;"'<>,.?/\\|`~]).{8,}$/.test(
    pwd
  );

const sanitizeUser = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.otp;
  delete obj.otpCreatedAt;
  delete obj.refreshTokenEncrypted;
  obj.roleNames = (obj.roles ?? []).map((r) => ROLE_NAMES[r] ?? "Unknown");
  return obj;
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE  —  POST /api/admin/users/create
// ─────────────────────────────────────────────────────────────────────────────
export const adminCreateUser = async (req, res) => {
  try {
    const adminId = req.user?.user?.id ?? req.user?.id;
    const { name, email, password, roles, phone, city } = req.body;

    // required
    if (!name?.trim())
      return errorData(res, 400, false, "Name is required.");
    if (!email?.trim())
      return errorData(res, 400, false, "Email is required.");
    if (!/^\S+@\S+\.\S+$/.test(email))
      return errorData(res, 400, false, "Invalid email format.");
    if (!password)
      return errorData(res, 400, false, "Password is required.");
    if (!isStrongPassword(password))
      return errorData(
        res, 400, false,
        "Password must be 8+ chars with uppercase, lowercase, number and special character."
      );

    // roles
    if (!roles || !Array.isArray(roles) || roles.length === 0)
      return errorData(res, 400, false, "Roles array is required. e.g. [2] or [3,4]");

    const parsedRoles = [...new Set(roles.map(Number))];
    const invalidRoles = parsedRoles.filter((r) => !VALID_ROLES.includes(r));
    if (invalidRoles.length > 0)
      return errorData(
        res, 400, false,
        `Invalid role(s): ${invalidRoles.join(", ")}. Valid: ${VALID_ROLES.map(
          (r) => `${r}=${ROLE_NAMES[r]}`
        ).join(", ")}`
      );
    if (parsedRoles.includes(ROLES.ADMIN))
      return errorData(res, 403, false, "Admin role cannot be assigned here.");

    // duplicates
    const emailExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (emailExists)
      return errorData(res, 409, false, "Email is already registered.");
    if (phone) {
      const phoneExists = await User.findOne({ phone });
      if (phoneExists)
        return errorData(res, 409, false, "Phone number is already registered.");
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      roles: parsedRoles,
      phone: phone || undefined,
      city: city || undefined,
      login_type: "email",
      verified_email: true,
      status: true,
      isDeleted: false,
      lastActive: new Date(),
      createdBy: adminId,
    });

    return successData(
      res, 201, true,
      `User created with role(s): ${parsedRoles.map((r) => ROLE_NAMES[r]).join(", ")}`,
      sanitizeUser(newUser)
    );
  } catch (err) {
    console.error("adminCreateUser error:", err);
    return errorData(res, 500, false, "Server Error", null, err?.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LIST  —  GET /api/admin/users
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Query params:
 *   page      default 1
 *   limit     default 10  (max 100)
 *   role      number — filter by role inside array
 *   status    true | false
 *   deleted   true = show only soft-deleted, false = active only (default)
 *   search    matches name / email / phone
 */
export const adminGetAllUsers = async (req, res) => {
  try {
    let { page = 1, limit = 10, role, status, deleted = "false", search } = req.query;

    page  = Math.max(1, parseInt(page, 10));
    limit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const query = {};

    // deleted filter — handles old docs that don't have isDeleted field
    if (deleted === "true") {
      query.isDeleted = true;
    } else {
      query.$or = [{ isDeleted: false }, { isDeleted: { $exists: false } }];
    }

    if (role) {
      const parsedRole = Number(role);
      if (VALID_ROLES.includes(parsedRole)) query.roles = { $in: [parsedRole] };
    }

    if (status !== undefined) query.status = status === "true";

    // search needs special handling when $or already exists from isDeleted
    if (search) {
      const re = new RegExp(search, "i");
      const searchConditions = [{ name: re }, { email: re }, { phone: re }];

      if (query.$or) {
        // combine both $or conditions using $and
        query.$and = [
          { $or: query.$or },
          { $or: searchConditions },
        ];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password -otp -otpCreatedAt -refreshTokenEncrypted")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    const mapped = users.map((u) => ({
      ...u,
      roleNames: (u.roles ?? []).map((r) => ROLE_NAMES[r] ?? "Unknown"),
    }));

    return successData(res, 200, true, "Users fetched successfully.", {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      users: mapped,
    });
  } catch (err) {
    console.error("adminGetAllUsers error:", err);
    return errorData(res, 500, false, "Server Error", null, err?.message);
  }
};

// get single user by id
export const adminGetUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -otp -otpCreatedAt -refreshTokenEncrypted"
    );

    if (!user) return errorData(res, 404, false, "User not found.");

    const obj = user.toObject();
    obj.roleNames = (obj.roles ?? []).map((r) => ROLE_NAMES[r] ?? "Unknown");

    return successData(res, 200, true, "User fetched successfully.", obj);
  } catch (err) {
    console.error("adminGetUserById error:", err);
    return errorData(res, 500, false, "Server Error", null, err?.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE  —  PATCH /api/admin/users/:id
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Updatable fields:
 *   name, email, phone, roles, city, status, password
 *
 * All fields are optional — send only what needs changing.
 */
export const adminUpdateUser = async (req, res) => {
  try {
    const { name, email, phone, roles, city, status, password } = req.body;

    const updateData = {};

    if (name !== undefined) updateData.name = name.trim();
    if (city !== undefined) updateData.city = city;

    if (status !== undefined) updateData.status = status === true || status === "true";

    // roles
    if (roles !== undefined) {
      if (!Array.isArray(roles) || roles.length === 0)
        return errorData(res, 400, false, "Roles must be a non-empty array.");

      const parsedRoles = [...new Set(roles.map(Number))];
      const invalidRoles = parsedRoles.filter((r) => !VALID_ROLES.includes(r));
      if (invalidRoles.length > 0)
        return errorData(
          res, 400, false,
          `Invalid role(s): ${invalidRoles.join(", ")}`
        );
      if (parsedRoles.includes(ROLES.ADMIN))
        return errorData(res, 403, false, "Admin role cannot be assigned here.");

      updateData.roles = parsedRoles;
    }

    // email — check uniqueness
    if (email !== undefined) {
      const normalised = email.toLowerCase().trim();
      const conflict = await User.findOne({ email: normalised, _id: { $ne: req.params.id } });
      if (conflict) return errorData(res, 409, false, "Email is already in use.");
      updateData.email = normalised;
    }

    // phone — check uniqueness
    if (phone !== undefined) {
      const conflict = await User.findOne({ phone, _id: { $ne: req.params.id } });
      if (conflict) return errorData(res, 409, false, "Phone number is already in use.");
      updateData.phone = phone;
    }

    // password reset by admin
    if (password !== undefined) {
      if (!isStrongPassword(password))
        return errorData(
          res, 400, false,
          "Password must be 8+ chars with uppercase, lowercase, number and special character."
        );
      updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password -otp -otpCreatedAt -refreshTokenEncrypted");

    if (!updated) return errorData(res, 404, false, "User not found.");

    const obj = updated.toObject();
    obj.roleNames = (obj.roles ?? []).map((r) => ROLE_NAMES[r] ?? "Unknown");

    return successData(res, 200, true, "User updated successfully.", obj);
  } catch (err) {
    console.error("adminUpdateUser error:", err);
    return errorData(res, 500, false, "Server Error", null, err?.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SOFT DELETE  —  DELETE /api/admin/users/:id
// ─────────────────────────────────────────────────────────────────────────────
export const adminDeleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return errorData(res, 404, false, "User not found.");

    if (user.isDeleted)
      return errorData(res, 400, false, "User is already deleted.");

    user.isDeleted = true;
    user.status    = false;
    user.deletedAt = new Date();
    await user.save();

    return successData(res, 200, true, "User deleted successfully.");
  } catch (err) {
    console.error("adminDeleteUser error:", err);
    return errorData(res, 500, false, "Server Error", null, err?.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RESTORE  —  PATCH /api/admin/users/:id/restore
// ─────────────────────────────────────────────────────────────────────────────
export const adminRestoreUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return errorData(res, 404, false, "User not found.");

    if (!user.isDeleted)
      return errorData(res, 400, false, "User is not deleted.");

    user.isDeleted = false;
    user.status    = true;
    user.deletedAt = null;
    await user.save();

    return successData(res, 200, true, "User restored successfully.", sanitizeUser(user));
  } catch (err) {
    console.error("adminRestoreUser error:", err);
    return errorData(res, 500, false, "Server Error", null, err?.message);
  }
};