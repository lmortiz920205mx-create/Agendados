importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCV432quSSYBQnvyVNoc7rXhw99x7UlMHg",
  authDomain: "taxi-platino-95ea3.firebaseapp.com",
  projectId: "taxi-platino-95ea3",
  messagingSenderId: "981982270950",
  appId: "1:981982270950:web:b7d0b4ca9ab03cafd97227"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  console.log("Push en background:", payload);

  self.registration.showNotification(
    payload.notification.title,
    {
      body: payload.notification.body,
      icon: "/favicon.ico"
    }
  );
});