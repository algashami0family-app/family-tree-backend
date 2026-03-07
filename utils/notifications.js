const admin = require('firebase-admin');

let initialized = false;

function initFirebase() {
  if (!initialized) {
    try {
      let serviceAccount;
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8');
        serviceAccount = JSON.parse(decoded);
      } else {
        serviceAccount = require('../serviceAccountKey.json');
      }
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      initialized = true;
      console.log('Firebase Admin initialized');
    } catch (e) {
      console.error('Firebase Admin init failed:', e.message);
    }
  }
}

async function sendNewsNotification(title, body, newsId) {
  try {
    initFirebase();
    const Member = require('../models/Member');
    const members = await Member.find({ fcmToken: { $ne: null } }).select('fcmToken');
    const tokens = members.map(m => m.fcmToken).filter(Boolean);
    if (tokens.length === 0) { console.log('No FCM tokens found'); return; }
    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { type: 'news', newsId: newsId?.toString() || '' },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
    console.log(`Sent notification to ${tokens.length} devices`);
  } catch (e) {
    console.error('Send notification error:', e.message);
  }
}

module.exports = { sendNewsNotification };
