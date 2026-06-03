import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDe5DPZCuq2CTU1CHxql5SyY5k4oFIH79M",
  authDomain: "diabetes-prediction-29eae.firebaseapp.com",
  projectId: "diabetes-prediction-29eae",
  storageBucket: "diabetes-prediction-29eae.firebasestorage.app",
  messagingSenderId: "132813489162",
  appId: "1:132813489162:web:e83a5fa94c6da459fd4bf3",
  measurementId: "G-21K2V14J17"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Try to initialize analytics (might fail in environments without window/document)
let analytics = null;
if (typeof window !== "undefined") {
    analytics = getAnalytics(app);
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export { analytics };
