import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyABdrJ6raEfDHl0Ii2Uhl6HS2LVkajFLKQ",
  authDomain: "healthguardai-ed37e.firebaseapp.com",
  projectId: "healthguardai-ed37e",
  storageBucket: "healthguardai-ed37e.firebasestorage.app",
  messagingSenderId: "820077945238",
  appId: "1:820077945238:web:68d3dc2fca7b08917a7db7",
  measurementId: "G-SBERHJL6BD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Try to initialize analytics (might fail in environments without window/document)
let analytics = null;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

export const auth = getAuth(app);

// Configure Google provider with required scopes and prompt
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("profile");
googleProvider.addScope("email");
// Force account chooser so users can pick their Google account every time
googleProvider.setCustomParameters({ prompt: "select_account" });

export { analytics };
