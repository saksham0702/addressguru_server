import express from "express";
import { updateFcmToken, testNotification } from "../controller/notification.Controller.js";
import { authenticate } from "../middleware/userAuth.js";

const router = express.Router();

// Both routes require the user to be logged in
router.put("/fcm-token", authenticate, updateFcmToken);
router.post("/test", authenticate, testNotification);

export default router;
