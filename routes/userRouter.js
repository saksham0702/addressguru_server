import express from "express";
import {
  changePassword,
  forgotPassword,
  getUserDetails,
  login,
  logout,
  register,
  resendOTP,
  registerAdmin,
  setNewPassword,
  updateProfile,
  verifyOTP,
} from "../controller/user.Controller.js";
import {authenticate} from "../middleware/userAuth.js";
import upload from "../middleware/multerConfig.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.send(`
    <h1 style="text-align:center;">
      Welcome to AddressGuru UAE Backend USER Router
    </h1>
  `);
});

// 🔓 Public routes
router.post("/login", login);
router.post("/register", register);
router.post("/register-admin", registerAdmin);
router.post("/verify-otp", verifyOTP);
router.post("/forgot-password", forgotPassword);
router.post("/resend-otp", resendOTP);
router.post("/reset-password", setNewPassword);

// 🔐 Protected routes
router.post("/logout", logout);
router.post("/change-password", authenticate, changePassword);
router.get("/me", authenticate, getUserDetails);

router.post(
  "/update-profile",
  authenticate,
  upload.single("image"),
  updateProfile,
);

export default router;
