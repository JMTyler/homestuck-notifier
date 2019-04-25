importScripts('lib/firebase-app-v5.10.0.js');
importScripts('lib/firebase-messaging-v5.10.0.js');
importScripts('fcm.js');

firebase.messaging().setBackgroundMessageHandler(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message.', payload);
    // Customize notification here
    var notificationTitle = 'Background Message Title';
    var notificationOptions = {
      body: 'Background Message body.',
      icon: '/firebase-logo.png'
    };

    return self.registration.showNotification(notificationTitle,
      notificationOptions);
});
