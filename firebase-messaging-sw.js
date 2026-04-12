importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDDrqLTUImklgFF1W59aWaNo1yg7GBmjo",
  authDomain: "nesbyen-masters-v2.firebaseapp.com",
  projectId: "nesbyen-masters-v2",
  messagingSenderId: "733141987995",
  appId: "1:733141987995:web:XXXXX"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body
  });
});
