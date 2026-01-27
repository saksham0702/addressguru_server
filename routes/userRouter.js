import express from "express";
import {
  changePassword,
  forgotPassword,
  getUserDetails,
  login,
  logout,
  register,
  resendOTP,
  setNewPassword,
  updateProfile,
  verifyOTP,
} from "../controller/user.Controller.js";
import authenticate from "../middleware/userAuth.js";
import upload from "../middleware/multerConfig.js";
const router = express.Router();

router.get("/", function (req, res, next) {
  return res.send(`<!DOCTYPE html><html><head><title>Welcome to Elevate_U Backend</title></head><body style="display: flex; align-items: center; justify-content: center;">
    <h1>Welcome to AddressGuru UAE Backend USER Router</h1>
  </body>
</html>`);
});

router.route("/login").post(login);

router.route("/logout").get(authenticate, logout);

router.route("/register").post(register);

router.route("/verify-otp").post(verifyOTP);

router.route("/forgot-password").post(forgotPassword);

router.route("/resend-otp").post(resendOTP);

router.route("/reset-password").post(setNewPassword);

router.route("/change-password").post(authenticate, changePassword);

router.route("/user-info").get(authenticate, getUserDetails);

// router
//   .route("/update-profile")
//   .put(authenticate, upload.single("image"), updateProfile);

router
  .route("/update-profile")
  .post(authenticate, upload.single("image"), updateProfile);

export default router;

// No changes needed, but confirm route is /api/user/login in main app.js
