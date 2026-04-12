importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:"AIzaSyDDrqLTUtImklgFF1W59aWaNolyg7GBmj0",
  authDomain:"nesbyen-masters-v2.firebaseapp.com",
  projectId:"nesbyen-masters-v2"
});

const db = firebase.firestore();
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body
  });
});
