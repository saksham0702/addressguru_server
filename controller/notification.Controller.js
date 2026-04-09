import User from "../model/userSchema.js";
import { errorData, successData } from "../services/helper.js";
import { sendPushNotification } from "../services/notification.service.js";

/**
 * @desc    Update FCM Token for logged-in user
 * @route   PUT /api/notifications/fcm-token
 * @access  Private
 */
export const updateFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    // console.log('FCM token:', fcmToken);
    const userId = req?.user?.id;
    // console.log('User ID:', userId);

    if (!fcmToken) {
      return errorData(res, 400, false, "fcmToken is required");
    }

    const updatedUser = await User.findByIdAndUpdate(userId, { fcmToken }, { new: true });
    // console.log('Updated user:', updatedUser);

    return successData(res, 200, true, "FCM token updated successfully", updatedUser);
  } catch (error) {
    console.warn("Create marketplace listing error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/**
 * @desc    Test send push notification
 * @route   POST /api/notifications/test
 * @access  Private / Admin
 */
export const testNotification = async (req, res) => {
  try {
    const { targetUserId, title, body, data } = req.body;
    console.log('Target user ID:', targetUserId || req.user.id);
    console.log('Title:', title || "Test Notification");
    console.log('Body:', body || "This is a test push notification from backend.");
    console.log('Data:', data || {});

    // Send to provided userId or self
    const sendToId = targetUserId || req?.user?.id;

    const response = await sendPushNotification(sendToId, title || "Test Notification", body || "This is a test push notification from backend.", data || {});

    return successData(res, 200, true, "Test notification sent successfully", response);
  } catch (error) {
    console.warn("Create marketplace listing error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};
