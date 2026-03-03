import { initializeApp } from 'firebase/app';
import { getFunctions } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC2ui7OrenBh-hlL0LBvbukNQGWZ0reU3o",
  authDomain: "mintage-crm.firebaseapp.com",
  projectId: "mintage-crm",
  storageBucket: "mintage-crm.firebasestorage.app",
  messagingSenderId: "903350463039",
  appId: "1:903350463039:web:460b2d249efd31fe30e68a",
  measurementId: "G-09SKMWLMQC"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Analytics (only in browser environment)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Initialize Cloud Functions (explicitly setting region to us-central1)
export const functions = getFunctions(app, 'us-central1');

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app, 'crmdb');
