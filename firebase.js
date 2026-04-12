const firebaseConfig = {
  apiKey: "AIzaSyDDrqLTUImklgFF1W59aWaNo1yg7GBmjo",
  authDomain: "nesbyen-masters-v2.firebaseapp.com",
  projectId: "nesbyen-masters-v2",
  messagingSenderId: "733141987995",
  appId: "1:733141987995:web:XXXXX" // <-- hvis du har den, hvis ikke går det fint uten
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
