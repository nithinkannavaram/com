import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDGFGfl0M-1-qcpLGeEhkK76MT3rwXMo4w",
  authDomain: "shopping-9ee42.firebaseapp.com",
  databaseURL: "https://shopping-9ee42-default-rtdb.firebaseio.com",
  projectId: "shopping-9ee42",
  storageBucket: "shopping-9ee42.firebasestorage.app",
  messagingSenderId: "223549367664",
  appId: "1:223549367664:web:deaa9bbefaeec43afcdbb5",
  measurementId: "G-GGXQN96H2H"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, analytics, db, auth };
