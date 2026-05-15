const fs = require("fs");
const path = require("path");
let admin = null;

const serviceAccountPath = path.join(__dirname, "../config/firebase-service-account.json");

if (fs.existsSync(serviceAccountPath)) {
  try {
    admin = require("firebase-admin");
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("🔥 [FCM] Firebase Admin SDK initialized successfully");
  } catch (err) {
    console.error("❌ [FCM] Error initializing Firebase Admin SDK:", err.message);
  }
} else {
  console.warn("⚠️ [FCM] firebase-service-account.json not found at backend/src/config/. FCM push notifications will be skipped.");
}

/**
 * Send push notification to a specific FCM token
 */
async function sendPushNotification(fcmToken, title, body, data = {}) {
  if (!admin) {
    console.warn("⚠️ [FCM] Skipped sending push notification because Firebase Admin is not initialized.");
    return null;
  }

  const message = {
    notification: {
      title: title,
      body: body,
    },
    android: {
      priority: "high",
      notification: {
        channelId: "cheating_alerts",
        sound: "default",
        clickAction: "FLUTTER_NOTIFICATION_CLICK"
      }
    },
    apns: {
      headers: {
        "apns-priority": "10",
        "apns-push-type": "alert",
      },
      payload: {
        aps: {
          alert: {
            title: title,
            body: body,
          },
          sound: "default",
          badge: 1,
          "content-available": 1,
          "mutable-content": 1,
        },
      },
    },
    data: data,
    token: fcmToken,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("✅ [FCM] Push notification sent successfully:", response);
    return response;
  } catch (error) {
    console.error("❌ [FCM] Error sending push notification:", error.message);
    return null;
  }
}

module.exports = { sendPushNotification };
