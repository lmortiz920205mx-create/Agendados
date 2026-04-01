import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

const firebaseConfig = {
    apiKey: "AIzaSyCV432quSSYBQnvyVNoc7rXhw99x7UlMHg",
    authDomain: "taxi-platino-95ea3.firebaseapp.com",
    projectId: "taxi-platino-95ea3",
    storageBucket: "taxi-platino-95ea3.firebasestorage.app",
    messagingSenderId: "981982270950",
    appId: "1:981982270950:web:b7d0b4ca9ab03cafd97227"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const messaging = getMessaging(app);
export const functions = getFunctions(app);