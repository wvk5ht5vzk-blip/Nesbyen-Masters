importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "DIN_API_KEY",
  authDomain: "DIN_APP.firebaseapp.com",
  projectId: "DIN_PROJECT_ID",
  messagingSenderId: "733141987995",
  appId: "DIN_APP_ID"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body
  });
});
