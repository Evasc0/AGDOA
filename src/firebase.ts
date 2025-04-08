// src/firebase.ts

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAjF3oLNRGFwh_BUYA4qF55zl0qw4dprwI",
  authDomain: "agduwaqueue.firebaseapp.com",
  databaseURL: "https://agduwaqueue-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "agduwaqueue",
  storageBucket: "agduwaqueue.appspot.com", // corrected from "firebasestorage.app"
  messagingSenderId: "242220098930",
  appId: "1:242220098930:web:4b5332473f339ca1be69eb",
  measurementId: "G-2CQ56KNPDZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Core services
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const rtdb = getDatabase(app);

// Optional: Analytics (guarded for environments like SSR or unsupported browsers)
let analytics: ReturnType<typeof getAnalytics> | null = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

export { app, db, auth, storage, rtdb };
