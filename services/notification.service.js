import admin from "firebase-admin";
import User from "../model/userSchema.js";
import { getFirebaseApp } from "./firebase.js";

export const sendPushNotification = async (
  userId,
  title,
  body,
  data = {}
) => {
  try {
    const firebaseApp = getFirebaseApp();

    if (!firebaseApp) {
      console.log("⚠️ Firebase not initialized → MOCK mode");
      return { success: true, mocked: true };
    }

    const user = await User.findById(userId).select(
      "fcmToken preferences_notifications_push"
    );

    console.log("User:", user);

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.preferences_notifications_push) {
      return { success: false, message: "Push disabled by user" };
    }

    if (!user.fcmToken) {
      return { success: false, message: "No FCM token" };
    }

    // Convert all data values to string (FCM requirement)
    const stringData = Object.fromEntries(
      Object.entries({
        ...data,
      }).map(([k, v]) => [k, String(v)])
    );

    const message = {
      token: user.fcmToken,
      notification: {
        title,
        body,
      },
      data: stringData,
      android: {
        priority: "high",
        notification: {
          channelId: "default",
          sound: "default",
          ...(data.image && { imageUrl: String(data.image) }),
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: "default",
            badge: 1,
            contentAvailable: true,
            mutableContent: true,
          },
        },
        fcm_options: {
          ...(data.image && { image: String(data.image) }),
        },
      },
    };

    const response = await admin.messaging().send(message);

    console.log("✅ Notification sent successfully:", response);

    return {
      success: true,
      messageId: response,
    };
  } catch (error) {
    console.error("❌ Push error full details:", JSON.stringify(error, null, 2));

    // Handle authentication errors specifically
    if (error.code === "messaging/third-party-auth-error") {
      console.error(
        "🚨 FCM Auth Error: APNs credentials or FCM V1 API missing/mismatched. Check your Firebase console settings."
      );
    }

    // Remove invalid token
    if (
      error.code === "messaging/invalid-registration-token" ||
      error.code === "messaging/registration-token-not-registered"
    ) {
      await User.findByIdAndUpdate(userId, { fcmToken: null });
      console.log("🧹 Removed invalid FCM token");
    }

    throw error;
  }
};