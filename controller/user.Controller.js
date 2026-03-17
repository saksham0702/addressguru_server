import bcrypt from "bcrypt";
import User from "../model/userSchema.js";
import { BACKEND_BASE_URL, ROLE_NAMES, ROLES } from "../services/constant.js";
import createJwtToken from "../utils/generateToken.js";
import {
  addUserLog,
  errorData,
  generateOTP,
  successData,
} from "../services/helper.js";
import { validateUser } from "../validations/user.Validator.js";
import {
  sendOTPMail,
  sendResendOTPMail,
  sendSuccessMail,
} from "../utils/sendMail.js";
import geoip from "geoip-lite";
import { UAParser } from "ua-parser-js";

const OTP_VALIDITY_MINUTES = 10;

export const login = async (req, res) => {
  console.log("LOGIN BODY:", req.body);

  try {
    const { email, password } = req.body;

    // 🌍 Get IP
    // const ip =
    //   req?.headers?.["x-forwarded-for"]?.split(",")[0] ||
    //   req?.socket?.remoteAddress ||
    //   null;

    // 🌍 Geo lookup
    // const geo = ip ? geoip.lookup(ip) : null;

    // 📱 Device info (safe)
    // const userAgent = req.headers["user-agent"] || "";
    // const uaParser = new UAParser(userAgent);
    // const deviceInfo = uaParser.getResult();

    // 🔎 Check user (FIXED)
    const user = await User.findOne({
      email,
      deletedAt: null,
    });

    if (!user) {
      return errorData(
        res,
        401,
        false,
        "This email is not registered. Please sign up.",
      );
    }

    // 🔐 Check password
    if (!user.password) {
      return errorData(
        res,
        401,
        false,
        "This account does not use password login.",
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return errorData(
        res,
        401,
        false,
        "Incorrect password. Please try again.",
      );
    }

    // 🪙 Create JWT
    const authToken = createJwtToken(user);

    // 🍪 Set cookie
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("authToken", authToken, {
      httpOnly: true,
      // secure: isProduction,
      // sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      // path: "/",
    });

    // 📝 Save login log
    // await addUserLog(user._id, {
    //   // ip,
    //   // geo,
    //   // deviceInfo,
    //   loginAt: new Date(),
    // });

    return successData(res, 200, true, "Login successful", {
      user,
      authToken,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const logout = async (req, res) => {
  try {
    // 🔥 Clear JWT cookie
    const isProduction = process.env.NODE_ENV === "production";
    res.clearCookie("authToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
    });

    return successData(res, 200, true, "Logout successful");
  } catch (err) {
    console.error("Logout Error:", err);
    return res.status(500).json({
      status: false,
      message: "Server error",
    });
  }
};

export const registerAdmin = async (req, res) => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({
      email: "admin@admin.com",
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Admin already exists",
        email: "admin@example.com",
      });
    }

    // Default admin credentials
    const defaultPassword = "Admin@123456";
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Create admin user
    const admin = await User.create({
      email: "admin@admin.com",
      password: hashedPassword,
      name: "System Admin",
      roles: [1], // Make sure this matches your ROLES.ADMIN value
      verified_email: true,
      verified_phone: false,
      login_type: "email",
      status: true,
    });

    return res.status(201).json({
      success: true,
      message: "Admin created successfully",
      credentials: {
        email: "admin@example.com",
        password: defaultPassword,
        note: "Please change this password after first login",
      },
      adminId: admin._id,
    });
  } catch (error) {
    console.error("Error creating admin:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating admin",
      error: error.message,
    });
  }
};

export const register = async (req, res) => {
  try {
    const { error, value } = validateUser.validate(req.body, {
      abortEarly: true,
    });

    if (error) {
      return successData(res, 400, false, error.details[0].message);
    }

    const {
      name,
      email,
      phone,
      whatsapp_same,
      password,
      avatar,
      role: rawRole,
      login_type,
      provider,
      providerId,
      profile_bio,
      profile_website,
      profile_location_emirate,
      profile_location_area,
      membership_type,
      membership_expiresAt,
      // preferences and others can be added as needed
    } = value;

    // check duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
      return successData(
        res,
        409,
        false,
        "This email is already registered. Try logging in.",
      );
    }

    // check duplicate phone if provided
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return successData(
          res,
          409,
          false,
          "This phone number is already registered.",
        );
      }
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Build user payload matching your User schema
    const userPayload = {
      name,
      email,
      phone,
      whatsapp_same,
      password: hashedPassword,
      avatar,
      login_type,
      provider,
      providerId,
      profile_bio,
      profile_website,
      profile_location_emirate,
      profile_location_area,
      membership_type,
      membership_expiresAt,
      status: true,
      lastActive: Date.now(),
    };

    // Create user
    const user = await User.create(userPayload);

    // Log activity (optional)
    // try {
    //   await addUserLog(user, req);
    // } catch (e) {
    //   console.warn("logActivity failed:", e?.message || e);
    // }

    const otp = generateOTP();
    user.otp = otp;
    user.otpCreatedAt = new Date();
    await user.save();

    console.log("OTP ::--->>", otp);

    // Send welcome mail (optional). sendMail should be implemented to not expose passwords.
    // try {
    //   // NOTE: it's unsafe to send plaintext passwords in real apps — consider sending a password-reset link or templated welcome email without password.
    //   await sendOTPMail(email, name, otp);
    // } catch (mailErr) {
    //   console.warn("sendMail failed:", mailErr?.message || mailErr);
    // }

    // Remove password from response
    // const userResponse = user.toObject();
    // delete userResponse.password;

    return successData(
      res,
      200,
      true,
      "OTP has been successfully sent to your registered email address.",
      { email },
    );

    // return successData(
    //   res,
    //   201,
    //   true,
    //   "Registered successfully!",
    //   userResponse
    // );
  } catch (err) {
    console.error("Register error:", err);
    return errorData(res, 500, false, "Server Error", null, err?.message);
  }
};

export const verifyOTP = async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ status: false, message: "Email is required." });
  }

  if (!otp || otp.length !== 6) {
    return res.status(400).json({
      status: false,
      message: "OTP is required and must be a 4-digit code.",
    });
  }

  try {
    // Check if the user exists
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ status: false, message: "User not found." });
    }

    // Check if OTP has expired
    const now = new Date();
    const otpCreatedAt = user.otpCreatedAt;
    const expiryTime = new Date(
      otpCreatedAt.getTime() + OTP_VALIDITY_MINUTES * 60000,
    );

    if (now > expiryTime) {
      return res.status(400).json({
        status: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Verify OTP matches
    if (user.otp !== otp) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid OTP. Please try again." });
    }

    user.otp = null;
    user.verified_email = true;

    await user.save();

    try {
      await sendSuccessMail(user?.name);
    } catch (mailErr) {
      console.warn("sendMail failed:", mailErr?.message || mailErr);
    }

    return res
      .status(200)
      .json({ status: true, message: "OTP Verify successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  console.log("LOGIN REQUEST BODY:", req?.body);

  try {
    const { email } = req.body;

    // 1. Check if email is provided
    if (!email || typeof email !== "string") {
      return errorData(res, 400, false, "Email address is required.");
    }

    // 2. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorData(res, 400, false, "Please enter a valid email address.");
    }

    // 3. Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return errorData(
        res,
        404,
        false,
        "No account found with this email address.",
      );
    }

    // 4. Generate OTP
    const otp = generateOTP();
    user.otp = otp;
    user.otpCreatedAt = new Date();
    await user.save();

    // 5. Send OTP email
    await sendResendOTPMail(email, user?.name, otp);
    // await sendSuccessMail(email, "Chirag");

    // 6. Respond success

    return successData(
      res,
      200,
      true,
      "OTP has been successfully sent to your registered email address.",
      {
        email,
      },
    );
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({
      status: false,
      message: "An unexpected error occurred. Please try again later.",
      error: err.message,
    });
  }
};

export const resendOTP = async (req, res) => {
  console.log("LOGIN RQQ BOODYY :", req?.body);

  try {
    const { email } = req.body;

    if (!email) {
      return errorData(res, 400, false, "Email address is required.");
    }

    const user = await User.findOne({ email });
    if (!user) {
      return errorData(
        res,
        404,
        false,
        "Sorry! We couldn't find your account.",
      );
    }

    // Generate OTP and prepare user payload
    const otp = generateOTP();
    // await User.updateOne({ _id: user._id }, { $set: { otp } });
    user.otp = otp;
    user.otpCreatedAt = new Date();
    await user.save();

    await sendResendOTPMail(email, user?.name, otp);

    return successData(
      res,
      200,
      true,
      "New OTP has been successfully sent to your registered email address.",
      {
        email,
      },
    );
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const setNewPassword = async (req, res) => {
  console.log("REQQ BODYY :", req?.body);
  const { email, newPassword } = req.body;

  if (!email) {
    return errorData(res, 400, false, "Email is required.");
  }
  if (!newPassword) {
    return errorData(res, 400, false, "New password is required.");
  }

  try {
    const user = await User.findOne({ email });
    console.log("USERRR :", user);

    if (!user) {
      return errorData(res, 404, false, "No account found with this email.");
    }

    // Optional: prevent using same password again
    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      return errorData(
        res,
        400,
        false,
        "New password must be different from the previous password.",
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    return successData(res, 200, true, "Password has been reset successfully.");
  } catch (err) {
    console.error("Set New Password Error:", err);
    return res.status(500).json({
      status: false,
      message: "Server error. Please try again later.",
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    console.log("REQQ BODY ::", req.body);
    console.log("REQQ USER ::", req.user?.user);
    const userInfo = req.user?.user;
    const userId = userInfo?.id;

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return successData(res, 400, false, "Old and new password are required.");
    }

    const user = await User.findById(userId);
    if (!user) return successData(res, 404, false, "User not found.");

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch)
      return successData(res, 400, false, "Old password is incorrect.");

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    return successData(res, 200, true, "Password changed successfully.");
  } catch (err) {
    console.error("Change password error:", err);
    return errorData(res, 500, false, "Server Error", null, err?.message);
  }
};

export const getUserDetails = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return errorData(res, 401, false, "Unauthorized");
    }

    const user = await User.findById(userId).select(
      "-password -otp -otpCreatedAt",
    );

    if (!user) {
      return errorData(res, 404, false, "User not found.");
    }

    return successData(
      res,
      200,
      true,
      "User details fetched successfully.",
      user,
    );
  } catch (err) {
    console.error("Get user details error:", err);
    return errorData(res, 500, false, "Server Error");
  }
};

export const updateProfile = async (req, res) => {
  try {
    console.log("RESS BODYY ::", req?.body);
    console.log("RESS FILE ::", req?.file);

    const userInfo = req.user?.user;
    const userId = userInfo?.id;

    const allowedFields = ["email", "name", "avatar", "phone"];

    const updateData = {};
    for (let key of allowedFields) {
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    }

    if (!req.file)
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });

    const filePath = req.file.path.replace(/\\/g, "/"); // normalize for Windows
    const imageUrl = `${BACKEND_BASE_URL}/${filePath}`;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true },
    ).select("-password -otp -otpCreatedAt");

    return successData(
      res,
      200,
      true,
      "Profile updated successfully.",
      updatedUser,
      imageUrl,
    );
  } catch (err) {
    console.error("Update profile error:", err);
    return errorData(res, 500, false, "Server Error", null, err?.message);
  }
};

////////////////////////////////////////////////////////////

/// MASTER ADMIN ///////

// ✅ GET ALL USERS (with pagination & filters)
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, status, search } = req.query;
    const query = { deletedAt: null };

    if (role) query.role = { $in: [Number(role)] };
    if (status) query.status = status === "true";
    if (search)
      query.$or = [
        { name: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { phone: new RegExp(search, "i") },
      ];

    const users = await User.find(query)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 })
      .lean(); // ⭐ FIX: return plain objects

    const mappedUsers = users.map((u) => ({
      ...u,
      roleName: ROLE_NAMES[u.role] || "UNKNOWN",
    }));

    const total = await User.countDocuments(query);

    return successData(res, 200, true, "Users fetched successfully.", {
      total,
      users: mappedUsers,
    });
  } catch (error) {
    return errorData(res, 500, false, "Server Error", null, err?.message);
  }
};

// ✅ GET USER DETAILS BY ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ UPDATE USER (admin update)
export const updateUser = async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "email",
      "phone",
      "role",
      "status",
      "membership_type",
      "city",
      "permission",
    ];
    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    if (!user) return errorData(res, 404, false, "User not found");

    return successData(res, 200, true, "Profile updated successfully.", user);
  } catch (error) {
    return errorData(res, 500, false, "Server Error", null, error?.message);
  }
};

// ✅ SOFT DELETE USER (set deletedAt)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { deletedAt: new Date(), status: false },
      { new: true },
    );

    if (!user) return errorData(res, 404, false, "User not found");

    return successData(res, 200, true, "User Deleted successfully.", user);
  } catch (error) {
    return errorData(res, 500, false, "Server Error", null, error?.message);
  }
};

// ✅ RESTORE USER (remove deletedAt)
export const restoreUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { deletedAt: null, status: true },
      { new: true },
    );

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.status(200).json({
      success: true,
      message: "User restored successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
