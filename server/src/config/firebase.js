const admin = require('firebase-admin');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

let messaging = null;

try {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    messaging = admin.messaging();
    console.log('[Firebase] Admin SDK initialized successfully with service account.');
  } else {
    console.log('[Firebase] Running in simulated FCM notification mode (No service account key configured).');
  }
} catch (err) {
  console.warn(`[Firebase] Initialization notice: ${err.message}. Running in simulated mode.`);
}

/**
 * Send Emergency FCM Push Notification to recipient device
 */
async function sendEmergencyPushNotification(fcmToken, alertData) {
  if (!fcmToken) {
    return { success: false, reason: 'Recipient has no registered FCM token' };
  }

  const payload = {
    notification: {
      title: '🚨 EMERGENCY ALERT - LifeGuard AI',
      body: `${alertData.senderName || 'A contact'} may be in distress! Tap to view location.`
    },
    data: {
      type: 'EMERGENCY_ALERT',
      emergencyId: String(alertData.emergencyId || ''),
      senderName: String(alertData.senderName || ''),
      soundLevel: String(alertData.soundLevel || ''),
      latitude: String(alertData.latitude || ''),
      longitude: String(alertData.longitude || ''),
      address: String(alertData.address || ''),
      timestamp: String(new Date().toISOString())
    },
    token: fcmToken
  };

  if (messaging) {
    try {
      const response = await messaging.send(payload);
      console.log(`[FCM] Notification sent successfully: ${response}`);
      return { success: true, messageId: response };
    } catch (err) {
      console.error(`[FCM] Failed to send push notification: ${err.message}`);
      return { success: false, error: err.message };
    }
  } else {
    console.log(`[FCM Simulation] Alert push sent to token: ${fcmToken.substring(0, 15)}... Payload:`, payload.notification.title);
    return { success: true, simulated: true };
  }
}

/**
 * Send Contact Request FCM Push Notification
 */
async function sendContactRequestPushNotification(fcmToken, contactData) {
  if (!fcmToken) return { success: false, reason: 'No token' };

  const payload = {
    notification: {
      title: 'LifeGuard AI - Contact Connection Request',
      body: `${contactData.senderName} invited you as an emergency contact.`
    },
    data: {
      type: 'CONTACT_REQUEST',
      senderName: String(contactData.senderName),
      senderMobile: String(contactData.senderMobile)
    },
    token: fcmToken
  };

  if (messaging) {
    try {
      const response = await messaging.send(payload);
      return { success: true, messageId: response };
    } catch (err) {
      return { success: false, error: err.message };
    }
  } else {
    console.log(`[FCM Simulation] Contact request push sent to: ${fcmToken.substring(0, 15)}...`);
    return { success: true, simulated: true };
  }
}

module.exports = {
  sendEmergencyPushNotification,
  sendContactRequestPushNotification
};
