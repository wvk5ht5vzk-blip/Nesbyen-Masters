importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDDrqLTUImklgFF1W59aWaNo1yg7GBmjo",
  authDomain: "nesbyen-masters-v2.firebaseapp.com",
  projectId: "nesbyen-masters-v2",
  messagingSenderId: "733141987995",
  appId: "1:733141987995:web:XXXXX"
});

// 🔥 DROPP messaging.onBackgroundMessage helt

self.addEventListener("push", function(event) {

  console.log("RAW PUSH:", event);

  let data = {};

  try {
    data = event.data.json();
  } catch(e) {
    console.log("No JSON payload");
  }

  console.log("PARSED:", data);

  const title =
    data.notification?.title ||
    data.data?.title ||
    "Nesbyen Masters";

  const body =
    data.notification?.body ||
    data.data?.body ||
    "Ny hendelse";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: "/icon..PNG"
    })
  );
});
