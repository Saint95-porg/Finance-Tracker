// js/firebase-config.js
import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ✅ REPLACE THESE WITH YOUR REAL VALUES FROM FIREBASE CONSOLE
// Firebase Console → Project Settings → Your Apps → SDK Setup → Config
const firebaseConfig = {
  apiKey:            "AIzaSyDh52CXgJiKekDG5Wr7dqgkIsYIC-JdOv4",
  authDomain:        "patrick-oloko-finance-tracker.firebaseapp.com",
  projectId:         "patrick-oloko-finance-tracker",
  storageBucket:     "patrick-oloko-finance-tracker.firebasestorage.app",
  messagingSenderId: "837402692205",
  appId:             "1:837402692205:web:72a4f8f0e0a5d87f0a8d64"
};

// Boot Firebase
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { auth, db };